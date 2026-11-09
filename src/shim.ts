// 本地 shim：替代 @hatch/space-sdk 的服务端面（defineAction / z / Ctx /
// ActionDefinition / ActionsModule）。只覆盖 actions.ts 实际用到的部分，
// 其余 SDK 能力（React 客户端、特权执行、agent 派生）不在独立部署里提供。
// Ctx 的数据库由 server.ts 注入（drizzle + libsql，本地 SQLite 文件）；
// blobs 是本地文件存储（见 blobs.ts）；inference 是本地规则分析
// （见 inference.ts），不是原空间的托管模型。
import { z } from "zod";
import type { LibSQLDatabase } from "drizzle-orm/libsql";

export { z };

export const ACTION_BRAND = "@hatch/space-sdk/action/v1" as const;

export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

export type SpaceDb<
  TSchema extends Record<string, unknown> = Record<string, never>,
> = Pick<
  LibSQLDatabase<TSchema>,
  "select" | "insert" | "update" | "delete" | "run" | "all" | "get" | "batch"
>;

export type SpaceDbAccessor = <
  TSchema extends Record<string, unknown> = Record<string, never>,
>() => SpaceDb<TSchema>;

export type BlobPutData = string | ArrayBuffer | ArrayBufferView | Blob;

export interface BlobPutOptions {
  readonly contentType?: string;
  readonly public?: boolean;
}

export interface BlobUrlOptions {
  readonly expiresInSeconds?: number;
  readonly public?: boolean;
}

export interface BlobClient {
  put(
    key: string,
    data: BlobPutData,
    options?: BlobPutOptions,
  ): Promise<void>;
  getUrl(key: string, options?: BlobUrlOptions): Promise<string>;
  delete(key: string): Promise<void>;
}

export interface InferenceCompleteOptions<
  T extends z.ZodType = z.ZodType,
> {
  readonly schema: T;
  readonly timeout_secs?: number;
  readonly system?: string;
  readonly images?: readonly {
    dataBase64: string;
    mimeType?: "image/jpeg" | "image/png";
    filename?: string;
    caption?: string;
  }[];
}

export interface InferenceClient {
  complete<T extends z.ZodType>(
    prompt: string,
    options: InferenceCompleteOptions<T>,
  ): Promise<z.infer<T>>;
}

/** 每次 action 调用拿到的上下文。invalidateQueries 在独立部署里是空操作
 * （没有跨客户端的 React Query 失效通道）；emit  likewise。 */
export interface Ctx {
  readonly slug: string;
  readonly invocationId: string;
  readonly spaceDir: string;
  readonly db: SpaceDbAccessor;
  readonly blobs: BlobClient;
  readonly inference: InferenceClient;
  emit(data: JsonValue): void;
  invalidateQueries(): void;
}

export interface ActionDefinition<
  Req extends z.ZodType = z.ZodType,
  Res extends z.ZodType = z.ZodType,
> {
  readonly __brand: typeof ACTION_BRAND;
  readonly request: Req;
  readonly response: Res;
  readonly description?: string;
  readonly handler: (ctx: Ctx, args: z.infer<Req>) => Promise<z.infer<Res>>;
}

export type ActionsModule = Record<
  string,
  ActionDefinition<z.ZodType, z.ZodType>
>;

export function defineAction<
  Req extends z.ZodType,
  Res extends z.ZodType,
>(spec: {
  request: Req;
  response: Res;
  description?: string;
  handler: (ctx: Ctx, args: z.infer<Req>) => Promise<z.infer<Res>>;
}): ActionDefinition<Req, Res> {
  return { __brand: ACTION_BRAND, ...spec };
}
