export interface ApiGatewayHttpInfo {
  method: string;
}

export interface ApiGatewayRequestContext {
  http: ApiGatewayHttpInfo;
}

export interface ApiGatewayProxyEventV2Like {
  rawPath: string;
  headers?: Record<string, string | undefined>;
  queryStringParameters?: Record<string, string | undefined>;
  requestContext: ApiGatewayRequestContext;
}

export interface ApiGatewayProxyResultV2Like {
  statusCode: number;
  headers?: Record<string, string>;
  body?: string;
  isBase64Encoded?: boolean;
}
