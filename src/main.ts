import { Handler, Context, SQSEvent } from 'aws-lambda';
import { Server } from 'http';
import { createServer, proxy } from 'aws-serverless-express';
import { eventContext } from 'aws-serverless-express/middleware';
import { NestFactory } from '@nestjs/core';
import { ExpressAdapter } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import helmet from 'helmet';
import { INestMicroservice } from '@nestjs/common';
import { MicroserviceOptions } from '@nestjs/microservices';
import { AWSSQSServer } from './servers';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const express = require('express');

// NOTE: If you get ERR_CONTENT_DECODING_FAILED in your browser, this
// is likely due to a compressed response (e.g. gzip) which has not
// been handled correctly by aws-serverless-express and/or API
// Gateway. Add the necessary MIME types to binaryMimeTypes below
const binaryMimeTypes: string[] = [];

let cachedServer: Server;
let cachedSQSServer: INestMicroservice;

// Create the Nest.js server and convert it into an Express.js server
async function bootstrapServer(): Promise<Server> {
  if (!cachedServer) {
    const expressApp = express();
    const nestApp = await NestFactory.create(
      AppModule,
      new ExpressAdapter(expressApp),
      {
        logger: console,
      },
    );
    nestApp.setGlobalPrefix(process.env.GLOBAL_PATH);
    nestApp.use(helmet());
    nestApp.use(eventContext());
    await nestApp.init();
    cachedServer = createServer(expressApp, undefined, binaryMimeTypes);
  }
  return cachedServer;
}

async function bootstrapSQSServer(event: SQSEvent, context: Context): Promise<INestMicroservice> {
  if (!cachedSQSServer) {
    cachedSQSServer = await NestFactory.createMicroservice<MicroserviceOptions>(
      AppModule,
      {
        strategy: new AWSSQSServer(event, context),
        logger: console,
      }
    );
  }

  return cachedSQSServer;
}

// Export the handler : the entry point of the Lambda function
export const handler: Handler = async (event: any, context: Context) => {
  cachedServer = await bootstrapServer();
  return proxy(cachedServer, event, context, 'PROMISE').promise;
};

export const sqsHandler: Handler = async (event: SQSEvent, context: Context) => {
  cachedSQSServer = await bootstrapSQSServer(event, context);
  await cachedSQSServer.listen();
  await cachedSQSServer.close();
};
