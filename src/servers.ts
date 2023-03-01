import { Logger } from "@nestjs/common";
import { CustomTransportStrategy, Server, Transport } from "@nestjs/microservices";
import { Context, SQSEvent, SQSRecord } from 'aws-lambda';

export class AWSSQSServer extends Server implements CustomTransportStrategy {


    constructor(private event: SQSEvent, private context: Context) {
        super();
    }

  async listen(callback: () => void) {
    const records = this.getRecords();
    for await (const record of records) {
      const key = this.getMessageAttribute(record);
      const msg = this.getMessage(record);

      Logger.debug(key, 'SQSKey');
      Logger.debug(msg, 'SQSMessage');
      Logger.debug(record, 'SQSRecord');

      const handler = this.messageHandlers.get(key);

      if (handler) {
        await handler(msg, this.context);
      } else {
        Logger.error(`${key} is not a valid handler.`);
      }
    }
    callback();
  }

  close() {
    return;
  }

  private getMessageAttribute(record: SQSRecord): string {
    const messageAttributeMap = record.messageAttributes;

    const returnArray: string[] = [];

    Object.keys(messageAttributeMap).forEach(key => {
      returnArray.push(`${key}:${messageAttributeMap[key].stringValue}`);
    })

    const stringifiedKey = JSON.stringify(Object.assign({}, returnArray));

    return stringifiedKey === `{}` ? '' : stringifiedKey;
  }

  private getMessage(record: SQSRecord): any {
    return record.body;
  }

  private getRecords(): SQSRecord[] {
    return this.event.Records;
  }
}
