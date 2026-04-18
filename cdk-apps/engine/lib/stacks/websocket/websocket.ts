import * as cdk from "aws-cdk-lib";
import * as appsync from "aws-cdk-lib/aws-appsync";
import { Construct } from "constructs";

interface WebsocketProps extends cdk.StackProps {
  titanEnvironment: string;
}

export class WebsocketStack extends cdk.NestedStack {
  public readonly apiKey: appsync.CfnApiKey;
  public readonly endpoint: string;
  constructor(scope: Construct, id: string, props: WebsocketProps) {
    super(scope, id, props);

    const { titanEnvironment } = props;

    const apiKeyProvider: appsync.AppSyncAuthProvider = {
      authorizationType: appsync.AppSyncAuthorizationType.API_KEY,
    };

    const api = new appsync.EventApi(this, "EventsAPI", {
      apiName: titanEnvironment,
      authorizationConfig: {
        authProviders: [apiKeyProvider],
        connectionAuthModeTypes: [appsync.AppSyncAuthorizationType.API_KEY],
        defaultPublishAuthModeTypes: [appsync.AppSyncAuthorizationType.API_KEY],
        defaultSubscribeAuthModeTypes: [
          appsync.AppSyncAuthorizationType.API_KEY,
        ],
      },
    });

    api.addChannelNamespace("default");
    this.apiKey = appsync.createAPIKey(this, api.apiId, {
      expires: cdk.Expiration.after(cdk.Duration.days(365)),
    });
    this.endpoint = api.httpDns;
  }
}
