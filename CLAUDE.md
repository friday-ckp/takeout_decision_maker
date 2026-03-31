# CLAUDE.md

## Story 开发规则

当用户出现以下意图时：

- “开始 story”
- “start story”
- “开始开发 story”
- “执行 story”
- 或其他明确表示要开始 Story 开发流程的表达

Claude 必须执行以下规则：

1. 自动加载并遵循 `/_bmad-output/story-dev-workflow-single-repo.md` 文件中的完整流程。
2. 严格按照该文件定义的步骤顺序执行，不得跳过步骤。
3. 在每个阶段输出当前执行的步骤名称，确保流程透明。
4. 如果流程中需要用户输入或确认，必须暂停并等待用户回复。
5. 所有生成的内容（代码、文档、测试等）必须符合该 workflow 文件中的规范。
6. 默认假设当前项目为 single-repo 结构，除非用户明确说明否则不得更改。
7. Story 开发完成后，提供总结，包括：
   - 已完成步骤
   - 生成文件列表
   - 下一步建议操作

## 触发关键词

触发该 workflow 的关键词包括：

- 开始 story
- start story
- story 开发
- 执行 story workflow
- run story workflow

一旦检测到上述关键词，立即进入 `story-dev-workflow-single-repo.md` 执行模式。
