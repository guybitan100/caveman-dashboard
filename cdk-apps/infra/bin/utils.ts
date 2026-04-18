import * as fs from "fs";
import * as path from "path";
import * as yaml from "js-yaml";
import { EnvContext } from "../lib/infra-stack";

export function loadConfig(cdkApp: string, configPath: string): EnvContext {
  const contextFilePath = path.resolve(configPath);
  console.log(`contextFilePath: ${contextFilePath}`);
  if (!fs.existsSync(contextFilePath)) {
    throw new Error(`Context file not found`);
  }

  const fullContext = yaml.load(
    fs.readFileSync(contextFilePath, "utf-8"),
  ) as Record<string, EnvContext>;
  const context: EnvContext = fullContext[cdkApp];

  console.log("\n##############################################");
  console.log(`#                EnvProps:                   #`);
  console.log("##############################################");
  console.log(`${yaml.dump(context, { indent: 2 })}`);
  console.log("##############################################\n");

  return context;
}
