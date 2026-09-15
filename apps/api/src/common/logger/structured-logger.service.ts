import { Injectable, LoggerService, Scope } from '@nestjs/common';

export interface LogEntry {
  timestamp: string;
  level: 'info' | 'warn' | 'error' | 'debug' | 'verbose';
  service: string;
  environment: string;
  message: string;
  context?: string | undefined;
  requestId?: string | undefined;
  organizationId?: string | undefined;
  actorId?: string | undefined;
  route?: string | undefined;
  statusCode?: number | undefined;
  durationMs?: number | undefined;
  error?:
    | {
        name?: string | undefined;
        message?: string | undefined;
        stack?: string | undefined;
      }
    | undefined;
}

@Injectable({ scope: Scope.DEFAULT })
export class StructuredLogger implements LoggerService {
  private readonly serviceName = 'api';
  private readonly environment = process.env.NODE_ENV || 'development';

  private print(entry: LogEntry): void {
    const jsonOutput = JSON.stringify(entry);
    if (entry.level === 'error') {
      process.stderr.write(`${jsonOutput}\n`);
    } else {
      process.stdout.write(`${jsonOutput}\n`);
    }
  }

  log(message: string, context?: string, metadata?: Partial<LogEntry>): void {
    this.print({
      timestamp: new Date().toISOString(),
      level: 'info',
      service: this.serviceName,
      environment: this.environment,
      message,
      context,
      ...metadata,
    });
  }

  error(message: any, stack?: string, context?: string, metadata?: Partial<LogEntry>): void {
    let msgString = '';
    let errStack = stack;

    if (message instanceof Error) {
      msgString = message.message;
      errStack = errStack || message.stack;
    } else if (typeof message === 'object' && message !== null) {
      msgString = message.message || message.description || JSON.stringify(message);
      errStack = errStack || message.stack;
    } else {
      msgString = String(message);
    }

    this.print({
      timestamp: new Date().toISOString(),
      level: 'error',
      service: this.serviceName,
      environment: this.environment,
      message: msgString,
      context,
      error: errStack ? { message: msgString, stack: errStack } : undefined,
      ...metadata,
    });
  }

  warn(message: string, context?: string, metadata?: Partial<LogEntry>): void {
    this.print({
      timestamp: new Date().toISOString(),
      level: 'warn',
      service: this.serviceName,
      environment: this.environment,
      message,
      context,
      ...metadata,
    });
  }

  debug(message: string, context?: string, metadata?: Partial<LogEntry>): void {
    this.print({
      timestamp: new Date().toISOString(),
      level: 'debug',
      service: this.serviceName,
      environment: this.environment,
      message,
      context,
      ...metadata,
    });
  }

  verbose(message: string, context?: string, metadata?: Partial<LogEntry>): void {
    this.print({
      timestamp: new Date().toISOString(),
      level: 'verbose',
      service: this.serviceName,
      environment: this.environment,
      message,
      context,
      ...metadata,
    });
  }
}
