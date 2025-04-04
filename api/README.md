# TM API

All TM components offer an API accessible over HTTP.
The API specification follows the OpenAPI standard.

# Directory

/openapi.yaml: root spec file

/components: contains specs grouped by TM component.
There is usually a file per agent, or per structure file.

/components/common.yaml: specs corresponding to general Hoon types

/paths: contains endpoint specs grouped by agent.

# Generating documentation

We use open-source edition of [Redocly](https://redocly.com).
To generate documentation, [install Redocly CLI](https://redocly.com/docs/cli/installation) and then run
```
> redocly preview-docs api/openapi.yaml
```
