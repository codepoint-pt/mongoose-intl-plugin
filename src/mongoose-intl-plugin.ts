"use strict";

const mongoose = require("mongoose"),
  extend = require("util")._extend;

function mongooseIntlPlugin(schema, options) {
  if (!options)
    throw new mongoose.Error(
      "Please define the options with languages and default language"
    );

  if (!Array.isArray(options.languages) || !options.languages.length) {
    throw new mongoose.Error("No languages defined");
  }

  schema.options.mongooseIntlPlugin = {};
  const pluginOptions = schema.options.mongooseIntlPlugin;

  pluginOptions.languages = options.languages.slice(0);

  if (
    !options.defaultLanguage ||
    pluginOptions.languages.indexOf(options.defaultLanguage) === -1
  ) {
    pluginOptions.defaultLanguage = pluginOptions.languages[0];
  } else {
    pluginOptions.defaultLanguage = options.defaultLanguage.slice(0);
  }

  schema.eachPath(function (path, schemaType) {
    if (schemaType.schema) {
      schemaType.schema.plugin(mongooseIntlPlugin, pluginOptions);
      return;
    }
    if (!schemaType.options.intl) {
      return;
    }
    if (!(schemaType instanceof mongoose.Schema.Types.String)) {
      throw new mongoose.Error(
        "Mongoose-intl-plugin only works in string type fields"
      );
    }

    let pathArray = path.split("."),
      key = pathArray.pop(),
      prefix = pathArray.join(".");
    if (prefix) prefix += ".";
    schema.remove(path);
    const tree = pathArray.reduce(function (mem, part) {
      return mem[part];
    }, schema.tree);
    delete tree[key];

    schema
      .virtual(path)
      .get(function () {
        const owner = this.ownerDocument ? this.ownerDocument() : this,
          lang = owner.getLanguage(),
          langSubDoc = (this.$__getValue || this.getValue).call(this, path);
        if (langSubDoc === null || langSubDoc === void 0) {
          return langSubDoc;
        }

        if (options.virtualization) {
          return langSubDoc;
        }

        if (langSubDoc.hasOwnProperty(lang)) {
          return langSubDoc[lang];
        }

        for (const prop in langSubDoc) {
          if (langSubDoc.hasOwnProperty(prop)) {
            return null;
          }
        }
        return void 0;
      })
      .set(function (value) {
        if (typeof value === "object") {
          const languages = this.schema.options.mongooseIntlPlugin.languages;
          languages.forEach(function (lang) {
            if (!value[lang]) {
              return;
            }
            this.set(path + "." + lang, value[lang]);
          }, this);
          return;
        }
        const owner = this.ownerDocument ? this.ownerDocument() : this;
        this.set(path + "." + owner.getLanguage(), value);
      });

    delete schemaType.options.intl;

    const intlObject = {};
    intlObject[key] = {};
    pluginOptions.languages.forEach(function (lang) {
      const langOptions = extend({}, schemaType.options);
      if (lang !== options.defaultLanguage) {
        delete langOptions.default;
        delete langOptions.required;
      }

      if (schemaType.options.defaultAll) {
        langOptions.default = schemaType.options.defaultAll;
      }

      if (schemaType.options.requiredAll) {
        langOptions.required = schemaType.options.requiredAll;
      }
      this[lang] = langOptions;
    }, intlObject[key]);
    schema.add(intlObject, prefix);
  });

  schema.method({
    getLanguages: function () {
      return this.schema.options.mongooseIntlPlugin.languages;
    },
    getLanguage: function () {
      return (
        this.docLanguage ||
        this.schema.options.mongooseIntlPlugin.defaultLanguage
      );
    },
    setLanguage: function (lang) {
      if (lang && this.getLanguages().indexOf(lang) !== -1) {
        this.docLanguage = lang;
      }
    },
    unsetLanguage: function () {
      delete this.docLanguage;
    },
  });

  schema.static({
    getLanguages: function () {
      return this.schema.options.mongooseIntlPlugin.languages;
    },
    getDefaultLanguage: function () {
      return this.schema.options.mongooseIntlPlugin.defaultLanguage;
    },
    setDefaultLanguage: function (lang) {
      function updateLanguage(schema, lang) {
        schema.options.mongooseIntlPlugin.defaultLanguage = lang.slice(0);

        schema.eachPath(function (path, schemaType) {
          if (schemaType.schema) {
            updateLanguage(schemaType.schema, lang);
          }
        });
      }
      if (lang && this.getLanguages().indexOf(lang) !== -1) {
        updateLanguage(this.schema, lang);
      }
    },
  });

  schema.on("init", function (model) {
    if (model.db.setDefaultLanguage) {
      return;
    }

    model.db.setDefaultLanguage = function (lang) {
      let model, modelName;
      for (modelName in this.models) {
        if (this.models.hasOwnProperty(modelName)) {
          model = this.models[modelName];
          model.setDefaultLanguage && model.setDefaultLanguage(lang);
        }
      }
    };

    if (!mongoose.setDefaultLanguage) {
      mongoose.setDefaultLanguage = mongoose.connection.setDefaultLanguage;
    }
  });
}
