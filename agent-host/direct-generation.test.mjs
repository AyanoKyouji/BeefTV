import {test,expect} from 'bun:test';
import {runDurableNodeCases} from './durable-node-test-runner.mjs';

test('ordered direct generation through the official Durable runtime',async()=>{
 expect(await runDurableNodeCases('./direct-generation-cases.mjs')).toContain('fail 0');
},45000);
