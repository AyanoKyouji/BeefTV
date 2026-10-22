import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createServer} from 'node:http';
import {AsyncLocalStorage} from 'node:async_hooks';
import {ModelRuntime} from '@earendil-works/pi-coding-agent';
import {createModels} from '@earendil-works/pi-ai/models';
import {createOperationBridge} from './operation-bridge.mjs';
import {createDurableSessionStore} from './durable-session-owner.mjs';

test('official Durable executes ordered generation tools without a frontend confirmation or duplicate submission', {timeout:30000},async()=>{
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'beeftv-direct-generation-'));
 const descriptors=JSON.parse(fs.readFileSync(new URL('./operation-descriptors.fixture.json',import.meta.url),'utf8'));
 const steps=[
  ['canvas_generation_start',{nodeId:'first',kind:'image',prompt:'首图'}],
  ['task_get',{taskId:'task-first',waitMs:20000}],
  ['canvas_task_bind',{nodeId:'first',taskId:'task-first'}],
  ['canvas_script_rows_append',{nodeId:'script',expectedRevision:3,rows:[{description:'根据首图编写分镜',durationSeconds:5}]}],
  ['canvas_generation_start',{nodeId:'shot',kind:'image',prompt:'分镜图'}],
  ['task_get',{taskId:'task-shot',waitMs:20000}],
  ['canvas_task_bind',{nodeId:'shot',taskId:'task-shot'}],
  ['canvas_generation_start',{nodeId:'video',kind:'video',prompt:'根据分镜图生成视频'}],
  ['task_get',{taskId:'task-video',waitMs:20000}],
  ['canvas_task_bind',{nodeId:'video',taskId:'task-video'}],
 ];
 const started=[],bound=new Set(),ready=new Set(),requests=[];let revision=1,scriptWritten=false,modelCalls=0,store;
 const listen=server=>new Promise(resolve=>server.listen(0,'127.0.0.1',()=>resolve(server.address().port)));
 const body=async req=>{let raw='';for await(const chunk of req)raw+=chunk;return JSON.parse(raw||'{}')};
 const ops=createServer(async(req,res)=>{
  const json=data=>res.end(JSON.stringify({code:0,data}));
  if(req.url==='/ops')return json({ops:descriptors});
  const {params:p}=await body(req);const op=req.url.slice('/ops/'.length);requests.push(op);let result={};
  if(op==='canvas.generation.start'){
   assert.equal(p.canvasId,'canvas');
   if(p.nodeId==='shot'){assert(bound.has('first'));assert(scriptWritten)}
   if(p.nodeId==='video')assert(bound.has('shot'));
   assert(!started.includes(p.nodeId));started.push(p.nodeId);
   result={canvasId:'canvas',nodeId:p.nodeId,taskId:'task-'+p.nodeId,status:'queued',revision:++revision};
  }else if(op==='task.get'){
   await new Promise(r=>setTimeout(r,25));ready.add(p.taskId);
   result={taskId:p.taskId,status:'succeeded',resultState:'READY',outputs:[{outputIndex:0,materializedAssetId:'asset-'+p.taskId,resourceId:'resource-'+p.taskId}]};
  }else if(op==='canvas.task.bind'){
   assert(ready.has(p.taskId));bound.add(p.nodeId);result={canvasId:'canvas',nodeId:p.nodeId,revision:++revision};
  }else if(op==='canvas.script.rows.append'){
   assert(bound.has('first'));scriptWritten=true;result={canvasId:'canvas',nodeId:'script',revision:++revision,created:[{id:'row1',shotNumber:1}]};
  }else throw new Error('Unexpected operation '+op);
  json({result});
 });
 const model=createServer(async(req,res)=>{
  const request=await body(req);const step=steps[modelCalls++];
  assert(request.tools.some(t=>t.function?.name==='canvas_generation_start'));
  assert(!request.tools.some(t=>t.function?.name==='canvas_generation_propose'));
  res.writeHead(200,{'content-type':'text/event-stream'});
  const frame=(delta,finish_reason=null)=>res.write('data: '+JSON.stringify({id:'fixture',object:'chat.completion.chunk',choices:[{index:0,delta,finish_reason}]})+'\n\n');
  frame(step?{role:'assistant',tool_calls:[{index:0,id:'call-'+modelCalls,type:'function',function:{name:step[0],arguments:JSON.stringify(step[1])}}]}:{role:'assistant',content:'按顺序完成首图、分镜、分镜图与视频。'});
  frame({},step?'tool_calls':'stop');res.end('data: [DONE]\n\n');
 });
 try{
  const opsPort=await listen(ops),modelPort=await listen(model);
  const runtime=await ModelRuntime.create({authPath:path.join(directory,'auth.json'),modelsPath:null,refreshOnCreate:false});
  runtime.registerProvider('beeftv',{api:'openai-completions',apiKey:'synthetic',baseUrl:`http://127.0.0.1:${modelPort}/v1`,models:[{id:'fixture',name:'fixture',reasoning:false,input:['text'],contextWindow:200000,maxTokens:4096,cost:{input:0,output:0,cacheRead:0,cacheWrite:0}}]});
  const models=createModels();models.setProvider(runtime.getProvider('beeftv'));
  const bridge=createOperationBridge({opsUrl:`http://127.0.0.1:${opsPort}`,hostToken:'synthetic',turnBudgetContext:new AsyncLocalStorage()});await bridge.loadDescriptors();
  store=createDurableSessionStore({sessionRoot:path.join(directory,'sessions'),workspaceRoot:directory,getModels:()=>models,getModelRef:()=>({provider:'beeftv',modelId:'fixture'}),buildTools:bridge.buildTools,authorizeTurn:async()=>({open:true,canvasId:'canvas',permissionMode:'canvas'}),completeTurn:async()=>{},settings:{retry:{maxRetries:0}}});
  const entry=await store.createSession('canvas');const submission=await store.submit(entry,{turnId:'ordered-generation',content:'先生成一张图片，再根据图片生成分镜，再根据分镜生成分镜图，最后根据分镜图生成视频'});
  const result=await store.wait(entry,submission);assert.equal(result.error,null);assert.deepEqual(started,['first','shot','video']);assert(bound.has('video'));assert.deepEqual(result.proposals,[]);assert.equal(requests.length,steps.length);
 }finally{await store?.disposeAll();for(const server of [ops,model]){server.closeAllConnections();await new Promise(r=>server.close(r))}fs.rmSync(directory,{recursive:true,force:true})}
});
