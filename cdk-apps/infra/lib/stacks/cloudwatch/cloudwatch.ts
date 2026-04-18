import * as cdk from "aws-cdk-lib";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as targets from "aws-cdk-lib/aws-events-targets";
import * as events from "aws-cdk-lib/aws-events";
import * as path from "path";
import { Construct } from "constructs";
import { NestedStack, NestedStackProps } from "aws-cdk-lib";

export class CloudWatchEventBridgeStack extends NestedStack {
  constructor(scope: Construct, id: string, props?: NestedStackProps) {
    super(scope, id, props);

    const region = cdk.Stack.of(this).region;
    const account = cdk.Stack.of(this).account;

    // Define the Lambda function with Python 3.13 runtime
    const lambdaFunction = new lambda.DockerImageFunction(
      this,
      "CloudFormationDiscoveryFn",
      {
        code: lambda.DockerImageCode.fromImageAsset(
          path.join(__dirname, "discover-stacks"),
        ),
        timeout: cdk.Duration.seconds(25),
      },
    );

    // Add necessary permissions to the Lambda function
    lambdaFunction.addToRolePolicy(
      new cdk.aws_iam.PolicyStatement({
        actions: ["cloudwatch:PutDashboard"],
        resources: [
          `arn:aws:cloudwatch::${account}:dashboard/SixStacksDashboard`,
        ],
      }),
    );
    lambdaFunction.addToRolePolicy(
      new cdk.aws_iam.PolicyStatement({
        actions: ["cloudformation:ListStacks"],
        resources: [`arn:aws:cloudformation:${region}:${account}:stack/*/*`],
      }),
    );
    lambdaFunction.addToRolePolicy(
      new cdk.aws_iam.PolicyStatement({
        actions: [
          "cloudwatch:PutDashboard",
          "cloudformation:DescribeStacks",
          "cloudformation:DeleteStack",
        ],
        resources: [
          `arn:aws:cloudformation:${region}:${account}:stack/engineEnv*/*`,
          `arn:aws:cloudformation:${region}:${account}:stack/EngineEnv*/*`,
          `arn:aws:cloudformation:${region}:${account}:stack/frontendEnv*/*`,
          `arn:aws:cloudformation:${region}:${account}:stack/FrontendEnv*/*`,
          `arn:aws:cloudformation:${region}:${account}:stack/infraEnv*/*`,
          `arn:aws:cloudformation:${region}:${account}:stack/InfraEnv*/*`,
        ],
      }),
    );

    // Define the first EventBridge rule (twice a day at 07:00 and 16:00 Asia/Jerusalem time)
    const rule1 = new events.Rule(this, "TwiceADay", {
      schedule: events.Schedule.expression("cron(0 7,16 * * ? *)"),
    });

    // Define the second EventBridge rule (every Thursday at 19:30 with payload)
    const rule2 = new events.Rule(this, "ThursdayNight", {
      schedule: events.Schedule.expression("cron(30 19 ? * 5 *)"),
    });
    const payload = {
      cleanup: "true",
    };

    rule1.addTarget(new targets.LambdaFunction(lambdaFunction));
    rule2.addTarget(
      new targets.LambdaFunction(lambdaFunction, {
        event: events.RuleTargetInput.fromObject(payload),
      }),
    );
  }
}
