#!/usr/bin/env node
import * as path from "path";
import { App, Tags } from "aws-cdk-lib";
import { InfraEnv } from "../lib/infra-stack";
import { loadConfig } from "./utils";

const app = new App();
const cdkApp = "infra";
const env = app.node.getContext("env") as string;
const version = app.node.getContext("version") as string;
const region = app.node.getContext("region") as string;
const account = app.node.getContext("account") as string;

if (!env) {
  throw new Error("Environment context (env) is required");
}

const relativePathToConfig = path.join(__dirname, "../../config/default.yaml");
const context = loadConfig(cdkApp, relativePathToConfig);

new InfraEnv(app, `InfraEnv-${env}`, {
  env: { account, region },
  context: context,
});

Tags.of(app).add("Owner", "lior.dux@cellebrite.com");
Tags.of(app).add("Project", "Six");
Tags.of(app).add("Team", "PlatformAI");
Tags.of(app).add("Environment", env);
Tags.of(app).add("Region", region);
Tags.of(app).add("Account", account);
Tags.of(app).add("CDK-app", cdkApp);
Tags.of(app).add("GitVersion", version);
