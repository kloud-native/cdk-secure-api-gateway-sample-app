# Welcome to your CDK TypeScript project

This is a TypeScript-based CDK app.

The `cdk.json` file tells the CDK Toolkit how to execute your app.

## Prerequisites
aws cli should be configured via `aws configure` (or any other method)

## Deployment steps

### Install dependences
`npm install`

### Compile TypeScript to JS
`npm run build` 

### Deploy
`npx cdk deploy` 

## Useful commands

* `npm run build`   compile typescript to js
* `npm run watch`   watch for changes and compile
* `npm run test`    perform the jest unit tests
* `npx cdk deploy`  deploy this stack to your default AWS account/region
* `npx cdk diff`    compare deployed stack with current state
* `npx cdk synth`   emits the synthesized CloudFormation template
