# Predictions MiniMax H3 接口字段

## 协议身份

- 插件 ID：`predictions-h3-video`。
- Provider ID：`predictions-h3-video`。
- 能力：`video`。
- 默认 Base URL：``。
- 鉴权驱动：`bearer`。
- 创建：`POST /api/v1/predictions`。
- 查询：`GET /api/v1/predictions/{{taskId}}`。

## 配置字段

| 字段 | 类型 | 必填 | 含义 |
| --- | --- | --- | --- |
| `apiKey` | secret | 是 | API Key |

## 统一字段映射

| 统一字段 | 类型 | 必填 | 上游映射 | 说明 |
| --- | --- | --- | --- | --- |
| `model` | string | 是 | `model` | 视频模型 ID。 |
| `prompt` | string | 是 | `prompt/content/input` | 视频提示词。 |
| `images` | media[] | 否 | `first/last/reference image` | 显式 role 图片输入。 |
| `videos` | media[] | 否 | `reference video` | 参考视频。 |
| `audios` | media[] | 否 | `reference audio/voice` | 参考音频或音色。 |
| `duration` | integer | 否 | `duration/seconds` | 时长秒数。 |
| `aspectRatio` | string | 否 | `ratio/aspect_ratio/size` | 画幅比例或尺寸。 |
| `resolution` | string | 否 | `resolution` | 分辨率档位。 |
| `generateAudio` | boolean | 否 | `generate_audio` | 是否生成音频。 |
| `watermark` | boolean | 否 | `watermark` | 水印开关。 |
| `providerOptions` | object | 否 | `provider-specific fields` | 插件命名空间内的厂商扩展字段。 |

## 上游请求模板逐字段清单

下表由插件请求模板生成，覆盖 body、query、headers 和 multipart 文件声明中的每个字段。

| 上游位置 | 值或转换表达式 |
| --- | --- |
| `create.method` | `"POST"` |
| `create.path` | `"/api/v1/predictions"` |
| `create.contentType` | `"application/json"` |
| `create.body.model` | `{"$ref":"request.model"}` |
| `create.body.input.prompt` | `{"$ref":"request.prompt"}` |
| `create.body.input.duration` | `{"$toInt":{"$coalesce":[{"$ref":"request.duration"},{"$ref":"request.extra.videoSeconds"},5]}}` |
| `create.body.input.resolution` | `{"$coalesce":[{"$ref":"request.resolution"},"768P"]}` |
| `create.body.input.aspect_ratio` | `{"$omitEmpty":{"$if":{"condition":{"$eq":[{"$coalesce":[{"$first":{"$map":{"from":{"$filter":{"from":{"$sortByOrder":{"$ref":"request.images"}},"as":"media","where":{"$in":[{"$ref":"media.role"},["first_frame"]]}}},"as":"media","in":{"$ref":"media.value"}}}},{"$if":{"condition":{"$eq":[{"$ref":"request.model"},"minimax-h3-max-turbo"]},"then":{"$first":{"$map":{"from":{"$sortByOrder":{"$ref":"request.images"}},"as":"media","in":{"$ref":"media.value"}}}},"else":null}}]},null]},"then":{"$coalesce":[{"$ref":"request.aspectRatio"},"16:9"]},"else":null}}}` |
| `create.body.input.image_url` | `{"$omitEmpty":{"$coalesce":[{"$first":{"$map":{"from":{"$filter":{"from":{"$sortByOrder":{"$ref":"request.images"}},"as":"media","where":{"$in":[{"$ref":"media.role"},["first_frame"]]}}},"as":"media","in":{"$ref":"media.value"}}}},{"$if":{"condition":{"$eq":[{"$ref":"request.model"},"minimax-h3-max-turbo"]},"then":{"$first":{"$map":{"from":{"$sortByOrder":{"$ref":"request.images"}},"as":"media","in":{"$ref":"media.value"}}}},"else":null}}]}}` |
| `create.body.input.end_image_url` | `{"$omitEmpty":{"$coalesce":[{"$first":{"$map":{"from":{"$filter":{"from":{"$sortByOrder":{"$ref":"request.images"}},"as":"media","where":{"$in":[{"$ref":"media.role"},["last_frame"]]}}},"as":"media","in":{"$ref":"media.value"}}}},{"$if":{"condition":{"$eq":[{"$ref":"request.model"},"minimax-h3-max-turbo"]},"then":{"$at":[{"$map":{"from":{"$sortByOrder":{"$ref":"request.images"}},"as":"media","in":{"$ref":"media.value"}}},1]},"else":null}}]}}` |
| `create.body.input.reference_image_urls` | `{"$omitEmpty":{"$if":{"condition":{"$eq":[{"$ref":"request.model"},"minimax-h3-max-turbo"]},"then":null,"else":{"$map":{"from":{"$filter":{"from":{"$sortByOrder":{"$ref":"request.images"}},"as":"media","where":{"$in":[{"$ref":"media.role"},["reference_image",""]]}}},"as":"media","in":{"$ref":"media.value"}}}}}}` |
| `create.body.input.reference_video_urls` | `{"$omitEmpty":{"$map":{"from":{"$ref":"request.videos"},"as":"media","in":{"$ref":"media.value"}}}}` |
| `create.body.input.reference_audio_urls` | `{"$omitEmpty":{"$map":{"from":{"$ref":"request.audios"},"as":"media","in":{"$ref":"media.value"}}}}` |
| `create.headers.Idempotency-Key` | `{"$ref":"request.extra.idempotencyKey"}` |
| `poll.method` | `"GET"` |
| `poll.path` | `"/api/v1/predictions/{{taskId}}"` |
| `poll.contentType` | `"application/json"` |

## Provider 扩展键

- 无额外扩展键。

动态模型或工作流允许使用文档声明的完整 `parameters/input/extra_body` 对象；该对象是协议本身的开放 schema，不会被宿主裁剪。

## 响应映射逐字段清单

| 映射位置 | 上游路径或转换表达式 |
| --- | --- |
| `response.taskId` | `{"$coalesce":[{"$ref":"response.data.task_id"},{"$ref":"taskId"}]}` |
| `response.status` | `{"$coalesce":[{"$ref":"response.data.status"},"pending"]}` |
| `response.message` | `{"$coalesce":[{"$ref":"response.error.message"},{"$ref":"response.message"},{"$ref":"response.fail_reason"}]}` |
| `response.videos` | `{"$ref":"response.data.outputs"}` |
| `response.errorPaths[0]` | `"code"` |
| `response.resultEphemeral` | `true` |
| `response.messagePaths[0]` | `"data.error"` |
| `response.messagePaths[1]` | `"msg"` |

## 响应与错误

插件把上游 task/status/text/media/usage 映射为统一结果。临时媒体 URL 标记为 ephemeral，由宿主立即下载持久化。HTTP 错误、业务 code 和 error object 保持失败语义，不包装成成功。

## 兼容边界

用于 /api/v1/predictions 的 MiniMax H3 包装协议。宿主先将本地参考素材上传到同渠道 /api/v1/files（每文件最多 20 MiB），再提交 URL；上传失败不会创建视频任务。首尾帧与参考素材不能混用。只发送 schema 声明的字段，不发送 watermark/generate_audio。提交携带稳定 Idempotency-Key，查询不重复创建。

<!-- BEEFTV_PLUGIN_MANIFEST_START -->
## Manifest 完整接口定义

以下 JSON 与插件包内实际 `manifest.json` 逐字段一致，覆盖插件身份、权限、配置、鉴权、参数、校验、创建、Agent、查询、取消、结果下载、响应和 Agent 响应映射。`documentation` 字段的值就是当前完整文档；为避免文档在自身内部无限递归，JSON 中仅用等义占位文本表示正文。

```json
{
  "apiVersion": "beeftv.plugin/v2",
  "id": "predictions-h3-video",
  "name": "Predictions MiniMax H3",
  "version": "2.0.0",
  "author": "BeefTV Contributors",
  "description": "Predictions MiniMax H3 独立请求协议插件。",
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
        "id": "predictions-h3-video",
        "label": "Predictions MiniMax H3",
        "capabilities": [
          "video"
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
            "mapping": "model",
            "description": "视频模型 ID。"
          },
          {
            "name": "prompt",
            "type": "string",
            "required": true,
            "mapping": "prompt/content/input",
            "description": "视频提示词。"
          },
          {
            "name": "images",
            "type": "media[]",
            "required": false,
            "mapping": "first/last/reference image",
            "description": "显式 role 图片输入。"
          },
          {
            "name": "videos",
            "type": "media[]",
            "required": false,
            "mapping": "reference video",
            "description": "参考视频。"
          },
          {
            "name": "audios",
            "type": "media[]",
            "required": false,
            "mapping": "reference audio/voice",
            "description": "参考音频或音色。"
          },
          {
            "name": "duration",
            "type": "integer",
            "required": false,
            "mapping": "duration/seconds",
            "description": "时长秒数。"
          },
          {
            "name": "aspectRatio",
            "type": "string",
            "required": false,
            "mapping": "ratio/aspect_ratio/size",
            "description": "画幅比例或尺寸。"
          },
          {
            "name": "resolution",
            "type": "string",
            "required": false,
            "mapping": "resolution",
            "description": "分辨率档位。"
          },
          {
            "name": "generateAudio",
            "type": "boolean",
            "required": false,
            "mapping": "generate_audio",
            "description": "是否生成音频。"
          },
          {
            "name": "watermark",
            "type": "boolean",
            "required": false,
            "mapping": "watermark",
            "description": "水印开关。"
          },
          {
            "name": "providerOptions",
            "type": "object",
            "required": false,
            "mapping": "provider-specific fields",
            "description": "插件命名空间内的厂商扩展字段。"
          }
        ],
        "validations": [
          {
            "assert": {
              "$in": [
                {
                  "$ref": "request.model"
                },
                [
                  "minimax-h3",
                  "minimax-h3-max",
                  "minimax-h3-max-turbo"
                ]
              ]
            },
            "message": "此协议仅适用于已核实的 MiniMax H3 模型"
          },
          {
            "assert": {
              "$in": [
                {
                  "$coalesce": [
                    {
                      "$ref": "request.resolution"
                    },
                    "768P"
                  ]
                },
                {
                  "$if": {
                    "condition": {
                      "$eq": [
                        {
                          "$ref": "request.model"
                        },
                        "minimax-h3"
                      ]
                    },
                    "then": [
                      "768P",
                      "2K",
                      "4K"
                    ],
                    "else": [
                      "480P",
                      "768P",
                      "1080P"
                    ]
                  }
                }
              ]
            },
            "message": "分辨率不在当前模型的中转 schema 中"
          },
          {
            "assert": {
              "$if": {
                "condition": {
                  "$eq": [
                    {
                      "$ref": "request.model"
                    },
                    "minimax-h3-max-turbo"
                  ]
                },
                "then": {
                  "$and": [
                    {
                      "$lte": [
                        {
                          "$len": {
                            "$ref": "request.images"
                          }
                        },
                        2
                      ]
                    },
                    {
                      "$eq": [
                        {
                          "$len": {
                            "$ref": "request.videos"
                          }
                        },
                        0
                      ]
                    },
                    {
                      "$eq": [
                        {
                          "$len": {
                            "$ref": "request.audios"
                          }
                        },
                        0
                      ]
                    }
                  ]
                },
                "else": true
              }
            },
            "message": "H3 Max Turbo 仅支持首尾帧，不能使用参考视频或音频"
          },
          {
            "assert": {
              "$and": [
                {
                  "$gte": [
                    {
                      "$toInt": {
                        "$coalesce": [
                          {
                            "$ref": "request.duration"
                          },
                          5
                        ]
                      }
                    },
                    5
                  ]
                },
                {
                  "$lte": [
                    {
                      "$toInt": {
                        "$coalesce": [
                          {
                            "$ref": "request.duration"
                          },
                          5
                        ]
                      }
                    },
                    15
                  ]
                }
              ]
            },
            "message": "MiniMax H3 时长必须为 5～15 秒"
          },
          {
            "assert": {
              "$lte": [
                {
                  "$len": {
                    "$ref": "request.prompt"
                  }
                },
                7000
              ]
            },
            "message": "提示词最多 7000 字符"
          },
          {
            "assert": {
              "$lte": [
                {
                  "$len": {
                    "$ref": "request.images"
                  }
                },
                9
              ]
            },
            "message": "最多 9 张参考图片"
          },
          {
            "assert": {
              "$lte": [
                {
                  "$len": {
                    "$ref": "request.videos"
                  }
                },
                3
              ]
            },
            "message": "最多 3 个参考视频"
          },
          {
            "assert": {
              "$lte": [
                {
                  "$len": {
                    "$ref": "request.audios"
                  }
                },
                3
              ]
            },
            "message": "最多 3 个参考音频"
          },
          {
            "assert": {
              "$lte": [
                {
                  "$add": [
                    {
                      "$len": {
                        "$ref": "request.images"
                      }
                    },
                    {
                      "$len": {
                        "$ref": "request.videos"
                      }
                    },
                    {
                      "$len": {
                        "$ref": "request.audios"
                      }
                    }
                  ]
                },
                12
              ]
            },
            "message": "参考素材合计最多 12 个"
          },
          {
            "assert": {
              "$not": {
                "$and": [
                  {
                    "$gt": [
                      {
                        "$len": {
                          "$filter": {
                            "from": {
                              "$sortByOrder": {
                                "$ref": "request.images"
                              }
                            },
                            "as": "media",
                            "where": {
                              "$in": [
                                {
                                  "$ref": "media.role"
                                },
                                [
                                  "first_frame",
                                  "last_frame"
                                ]
                              ]
                            }
                          }
                        }
                      },
                      0
                    ]
                  },
                  {
                    "$gt": [
                      {
                        "$add": [
                          {
                            "$len": {
                              "$filter": {
                                "from": {
                                  "$sortByOrder": {
                                    "$ref": "request.images"
                                  }
                                },
                                "as": "media",
                                "where": {
                                  "$in": [
                                    {
                                      "$ref": "media.role"
                                    },
                                    [
                                      "reference_image",
                                      ""
                                    ]
                                  ]
                                }
                              }
                            }
                          },
                          {
                            "$len": {
                              "$ref": "request.videos"
                            }
                          },
                          {
                            "$len": {
                              "$ref": "request.audios"
                            }
                          }
                        ]
                      },
                      0
                    ]
                  }
                ]
              }
            },
            "message": "首尾帧不能与参考素材混用"
          },
          {
            "assert": {
              "$or": [
                {
                  "$eq": [
                    {
                      "$len": {
                        "$filter": {
                          "from": {
                            "$sortByOrder": {
                              "$ref": "request.images"
                            }
                          },
                          "as": "media",
                          "where": {
                            "$in": [
                              {
                                "$ref": "media.role"
                              },
                              [
                                "last_frame"
                              ]
                            ]
                          }
                        }
                      }
                    },
                    0
                  ]
                },
                {
                  "$gt": [
                    {
                      "$len": {
                        "$filter": {
                          "from": {
                            "$sortByOrder": {
                              "$ref": "request.images"
                            }
                          },
                          "as": "media",
                          "where": {
                            "$in": [
                              {
                                "$ref": "media.role"
                              },
                              [
                                "first_frame"
                              ]
                            ]
                          }
                        }
                      }
                    },
                    0
                  ]
                }
              ]
            },
            "message": "尾帧需要同时提供首帧"
          },
          {
            "assert": {
              "$or": [
                {
                  "$eq": [
                    {
                      "$len": {
                        "$ref": "request.audios"
                      }
                    },
                    0
                  ]
                },
                {
                  "$gt": [
                    {
                      "$add": [
                        {
                          "$len": {
                            "$ref": "request.images"
                          }
                        },
                        {
                          "$len": {
                            "$ref": "request.videos"
                          }
                        }
                      ]
                    },
                    0
                  ]
                }
              ]
            },
            "message": "参考音频需要同时提供图片或视频"
          }
        ],
        "create": {
          "method": "POST",
          "path": "/api/v1/predictions",
          "contentType": "application/json",
          "body": {
            "model": {
              "$ref": "request.model"
            },
            "input": {
              "prompt": {
                "$ref": "request.prompt"
              },
              "duration": {
                "$toInt": {
                  "$coalesce": [
                    {
                      "$ref": "request.duration"
                    },
                    {
                      "$ref": "request.extra.videoSeconds"
                    },
                    5
                  ]
                }
              },
              "resolution": {
                "$coalesce": [
                  {
                    "$ref": "request.resolution"
                  },
                  "768P"
                ]
              },
              "aspect_ratio": {
                "$omitEmpty": {
                  "$if": {
                    "condition": {
                      "$eq": [
                        {
                          "$coalesce": [
                            {
                              "$first": {
                                "$map": {
                                  "from": {
                                    "$filter": {
                                      "from": {
                                        "$sortByOrder": {
                                          "$ref": "request.images"
                                        }
                                      },
                                      "as": "media",
                                      "where": {
                                        "$in": [
                                          {
                                            "$ref": "media.role"
                                          },
                                          [
                                            "first_frame"
                                          ]
                                        ]
                                      }
                                    }
                                  },
                                  "as": "media",
                                  "in": {
                                    "$ref": "media.value"
                                  }
                                }
                              }
                            },
                            {
                              "$if": {
                                "condition": {
                                  "$eq": [
                                    {
                                      "$ref": "request.model"
                                    },
                                    "minimax-h3-max-turbo"
                                  ]
                                },
                                "then": {
                                  "$first": {
                                    "$map": {
                                      "from": {
                                        "$sortByOrder": {
                                          "$ref": "request.images"
                                        }
                                      },
                                      "as": "media",
                                      "in": {
                                        "$ref": "media.value"
                                      }
                                    }
                                  }
                                },
                                "else": null
                              }
                            }
                          ]
                        },
                        null
                      ]
                    },
                    "then": {
                      "$coalesce": [
                        {
                          "$ref": "request.aspectRatio"
                        },
                        "16:9"
                      ]
                    },
                    "else": null
                  }
                }
              },
              "image_url": {
                "$omitEmpty": {
                  "$coalesce": [
                    {
                      "$first": {
                        "$map": {
                          "from": {
                            "$filter": {
                              "from": {
                                "$sortByOrder": {
                                  "$ref": "request.images"
                                }
                              },
                              "as": "media",
                              "where": {
                                "$in": [
                                  {
                                    "$ref": "media.role"
                                  },
                                  [
                                    "first_frame"
                                  ]
                                ]
                              }
                            }
                          },
                          "as": "media",
                          "in": {
                            "$ref": "media.value"
                          }
                        }
                      }
                    },
                    {
                      "$if": {
                        "condition": {
                          "$eq": [
                            {
                              "$ref": "request.model"
                            },
                            "minimax-h3-max-turbo"
                          ]
                        },
                        "then": {
                          "$first": {
                            "$map": {
                              "from": {
                                "$sortByOrder": {
                                  "$ref": "request.images"
                                }
                              },
                              "as": "media",
                              "in": {
                                "$ref": "media.value"
                              }
                            }
                          }
                        },
                        "else": null
                      }
                    }
                  ]
                }
              },
              "end_image_url": {
                "$omitEmpty": {
                  "$coalesce": [
                    {
                      "$first": {
                        "$map": {
                          "from": {
                            "$filter": {
                              "from": {
                                "$sortByOrder": {
                                  "$ref": "request.images"
                                }
                              },
                              "as": "media",
                              "where": {
                                "$in": [
                                  {
                                    "$ref": "media.role"
                                  },
                                  [
                                    "last_frame"
                                  ]
                                ]
                              }
                            }
                          },
                          "as": "media",
                          "in": {
                            "$ref": "media.value"
                          }
                        }
                      }
                    },
                    {
                      "$if": {
                        "condition": {
                          "$eq": [
                            {
                              "$ref": "request.model"
                            },
                            "minimax-h3-max-turbo"
                          ]
                        },
                        "then": {
                          "$at": [
                            {
                              "$map": {
                                "from": {
                                  "$sortByOrder": {
                                    "$ref": "request.images"
                                  }
                                },
                                "as": "media",
                                "in": {
                                  "$ref": "media.value"
                                }
                              }
                            },
                            1
                          ]
                        },
                        "else": null
                      }
                    }
                  ]
                }
              },
              "reference_image_urls": {
                "$omitEmpty": {
                  "$if": {
                    "condition": {
                      "$eq": [
                        {
                          "$ref": "request.model"
                        },
                        "minimax-h3-max-turbo"
                      ]
                    },
                    "then": null,
                    "else": {
                      "$map": {
                        "from": {
                          "$filter": {
                            "from": {
                              "$sortByOrder": {
                                "$ref": "request.images"
                              }
                            },
                            "as": "media",
                            "where": {
                              "$in": [
                                {
                                  "$ref": "media.role"
                                },
                                [
                                  "reference_image",
                                  ""
                                ]
                              ]
                            }
                          }
                        },
                        "as": "media",
                        "in": {
                          "$ref": "media.value"
                        }
                      }
                    }
                  }
                }
              },
              "reference_video_urls": {
                "$omitEmpty": {
                  "$map": {
                    "from": {
                      "$ref": "request.videos"
                    },
                    "as": "media",
                    "in": {
                      "$ref": "media.value"
                    }
                  }
                }
              },
              "reference_audio_urls": {
                "$omitEmpty": {
                  "$map": {
                    "from": {
                      "$ref": "request.audios"
                    },
                    "as": "media",
                    "in": {
                      "$ref": "media.value"
                    }
                  }
                }
              }
            }
          },
          "originPath": true,
          "headers": {
            "Idempotency-Key": {
              "$ref": "request.extra.idempotencyKey"
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
          "message": {
            "$coalesce": [
              {
                "$ref": "response.error.message"
              },
              {
                "$ref": "response.message"
              },
              {
                "$ref": "response.fail_reason"
              }
            ]
          },
          "videos": {
            "$ref": "response.data.outputs"
          },
          "errorPaths": [
            "code"
          ],
          "resultEphemeral": true,
          "messagePaths": [
            "data.error",
            "msg"
          ]
        }
      }
    ]
  }
}
```
<!-- BEEFTV_PLUGIN_MANIFEST_END -->
