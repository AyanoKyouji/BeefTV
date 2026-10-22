# 接口合同

- Bearer API Key 从渠道配置读取。
- 上传：`POST /api/v1/files`，multipart 字段 `files`；读取 `data.list[].url`。单文件最多 20 MiB。
- 提交：`POST /api/v1/predictions`，JSON 为 `model` 与 `input`。参数包括 `prompt`、`image_urls`、`aspect_ratio`、`resolution`、`enable_prompt_expansion: false` 与 `output_format: png`。
- 分辨率：`512sq`、`768sq`、`1k`、`2k`、`4k`。配置中的 `auto` 映射为 `1k`。
- 查询：`GET /api/v1/predictions/{task_id}`，每 3 秒查询。`pending` / `running` 等待，`success` 下载 `data.outputs` 并交付节点，`failed` 停止依赖链。
- 响应信封 `code != 0` 表示失败，HTTP 200 也不视为成功。
- 本协议不调用 `/images/edits`，不将 base64 作为参考图 URL 发送，也不替换其他渠道的 FLUX 协议。

<!-- BEEFTV_PLUGIN_MANIFEST_START -->
## Manifest 完整接口定义

以下 JSON 与插件包内实际 `manifest.json` 逐字段一致，覆盖插件身份、权限、配置、鉴权、参数、校验、创建、Agent、查询、取消、结果下载、响应和 Agent 响应映射。`documentation` 字段的值就是当前完整文档；为避免文档在自身内部无限递归，JSON 中仅用等义占位文本表示正文。

```json
{
  "apiVersion": "beeftv.plugin/v2",
  "id": "predictions-flux-image",
  "name": "Predictions FLUX Image",
  "version": "1.0.0",
  "author": "BeefTV Contributors",
  "description": "FLUX 图片生成与参考图编辑，共用 Predictions 异步任务接口。",
  "documentation": "<当前插件的完整 documentation，由 README.md 与 docs/interface.md 拼接而成；为避免 JSON 递归，此处不重复展开正文。>",
  "permissions": [
    "generation.run",
    "media.read"
  ],
  "configuration": {
    "fields": [
      {
        "name": "apiKey",
        "type": "secret",
        "label": "API Key",
        "required": true
      }
    ]
  },
  "contributes": {
    "providers": [
      {
        "id": "predictions-flux-image",
        "label": "Predictions FLUX Image",
        "capabilities": [
          "image"
        ],
        "scopes": [
          "admin.system-channel",
          "user.custom-channel",
          "canvas",
          "creation",
          "agent"
        ],
        "baseUrl": "",
        "requiresPublicMediaUrls": true,
        "auth": {
          "type": "bearer",
          "field": "apiKey"
        },
        "parameters": [
          {
            "name": "model",
            "type": "string",
            "required": true,
            "description": "flux-3-image"
          },
          {
            "name": "prompt",
            "type": "string",
            "required": true,
            "description": "图片提示词"
          },
          {
            "name": "images",
            "type": "media[]",
            "description": "最多十张参考图片 URL"
          },
          {
            "name": "aspectRatio",
            "type": "string",
            "description": "宽高比"
          },
          {
            "name": "quality",
            "type": "string",
            "description": "分辨率，默认1k"
          }
        ],
        "validations": [
          {
            "assert": {
              "$eq": [
                {
                  "$ref": "request.model"
                },
                "flux-3-image"
              ]
            },
            "message": "此协议仅适用于已核实的 flux-3-image"
          },
          {
            "assert": {
              "$lte": [
                {
                  "$len": {
                    "$ref": "request.images"
                  }
                },
                10
              ]
            },
            "message": "最多支持10张参考图"
          },
          {
            "assert": {
              "$eq": [
                {
                  "$len": {
                    "$ref": "request.videos"
                  }
                },
                0
              ]
            },
            "message": "不支持参考视频"
          },
          {
            "assert": {
              "$eq": [
                {
                  "$len": {
                    "$ref": "request.audios"
                  }
                },
                0
              ]
            },
            "message": "不支持参考音频"
          },
          {
            "assert": {
              "$in": [
                {
                  "$coalesce": [
                    {
                      "$ref": "request.quality"
                    },
                    "auto"
                  ]
                },
                [
                  "auto",
                  "512sq",
                  "768sq",
                  "1k",
                  "2k",
                  "4k"
                ]
              ]
            },
            "message": "分辨率不支持，请选择1k或其他已声明档位"
          }
        ],
        "create": {
          "method": "POST",
          "path": "/api/v1/predictions",
          "originPath": true,
          "contentType": "application/json",
          "headers": {
            "Idempotency-Key": {
              "$ref": "request.extra.idempotencyKey"
            }
          },
          "body": {
            "model": {
              "$ref": "request.model"
            },
            "input": {
              "prompt": {
                "$ref": "request.prompt"
              },
              "aspect_ratio": {
                "$coalesce": [
                  {
                    "$ref": "request.aspectRatio"
                  },
                  "auto"
                ]
              },
              "resolution": {
                "$if": {
                  "condition": {
                    "$in": [
                      {
                        "$ref": "request.quality"
                      },
                      [
                        null,
                        "",
                        "auto"
                      ]
                    ]
                  },
                  "then": "1k",
                  "else": {
                    "$ref": "request.quality"
                  }
                }
              },
              "image_urls": {
                "$omitEmpty": {
                  "$map": {
                    "from": {
                      "$ref": "request.images"
                    },
                    "as": "media",
                    "in": {
                      "$ref": "media.value"
                    }
                  }
                }
              },
              "enable_prompt_expansion": false,
              "output_format": "png"
            }
          }
        },
        "poll": {
          "method": "GET",
          "path": "/api/v1/predictions/{{taskId}}",
          "originPath": true
        },
        "response": {
          "taskId": {
            "$coalesce": [
              {
                "$ref": "response.data.task_id"
              },
              {
                "$ref": "taskId"
              }
            ]
          },
          "status": {
            "$coalesce": [
              {
                "$ref": "response.data.status"
              },
              "pending"
            ]
          },
          "images": {
            "$ref": "response.data.outputs"
          },
          "messagePaths": [
            "data.error",
            "msg"
          ],
          "errorPaths": [
            "code"
          ],
          "resultEphemeral": true
        }
      }
    ]
  }
}
```
<!-- BEEFTV_PLUGIN_MANIFEST_END -->
