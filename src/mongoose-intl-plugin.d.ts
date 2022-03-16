import { Schema } from "mongoose";

interface IntlPluginOptions {
  languages: Array<string>;
  defaultLanguage: string;
  virtualization: true;
}

declare function mongooseIntlPlugin(
  schema: Schema,
  options?: IntlPluginOptions
): void;

export = mongooseIntlPlugin;
