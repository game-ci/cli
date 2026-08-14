import { createRequire } from "node:module";
var __create = Object.create;
var __getProtoOf = Object.getPrototypeOf;
var __defProp = Object.defineProperty;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
function __accessProp(key) {
  return this[key];
}
var __toESMCache_node;
var __toESMCache_esm;
var __toESM = (mod, isNodeMode, target) => {
  var canCache = mod != null && typeof mod === "object";
  if (canCache) {
    var cache = isNodeMode ? __toESMCache_node ??= new WeakMap : __toESMCache_esm ??= new WeakMap;
    var cached = cache.get(mod);
    if (cached)
      return cached;
  }
  target = mod != null ? __create(__getProtoOf(mod)) : {};
  const to = isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target;
  for (let key of __getOwnPropNames(mod))
    if (!__hasOwnProp.call(to, key))
      __defProp(to, key, {
        get: __accessProp.bind(mod, key),
        enumerable: true
      });
  if (canCache)
    cache.set(mod, to);
  return to;
};
var __commonJS = (cb, mod) => () => (mod || cb((mod = { exports: {} }).exports, mod), mod.exports);
var __returnValue = (v) => v;
function __exportSetter(name, newValue) {
  this[name] = __returnValue.bind(null, newValue);
}
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, {
      get: all[name],
      enumerable: true,
      configurable: true,
      set: __exportSetter.bind(all, name)
    });
};
var __esm = (fn, res) => () => (fn && (res = fn(fn = 0)), res);
var __require = /* @__PURE__ */ createRequire(import.meta.url);

// node_modules/semver/internal/constants.js
var require_constants = __commonJS((exports, module) => {
  var SEMVER_SPEC_VERSION = "2.0.0";
  var MAX_LENGTH = 256;
  var MAX_SAFE_INTEGER = Number.MAX_SAFE_INTEGER || 9007199254740991;
  var MAX_SAFE_COMPONENT_LENGTH = 16;
  var MAX_SAFE_BUILD_LENGTH = MAX_LENGTH - 6;
  var RELEASE_TYPES = [
    "major",
    "premajor",
    "minor",
    "preminor",
    "patch",
    "prepatch",
    "prerelease"
  ];
  module.exports = {
    MAX_LENGTH,
    MAX_SAFE_COMPONENT_LENGTH,
    MAX_SAFE_BUILD_LENGTH,
    MAX_SAFE_INTEGER,
    RELEASE_TYPES,
    SEMVER_SPEC_VERSION,
    FLAG_INCLUDE_PRERELEASE: 1,
    FLAG_LOOSE: 2
  };
});

// node_modules/semver/internal/debug.js
var require_debug = __commonJS((exports, module) => {
  var debug = typeof process === "object" && process.env && process.env.NODE_DEBUG && /\bsemver\b/i.test(process.env.NODE_DEBUG) ? (...args) => console.error("SEMVER", ...args) : () => {};
  module.exports = debug;
});

// node_modules/semver/internal/re.js
var require_re = __commonJS((exports, module) => {
  var {
    MAX_SAFE_COMPONENT_LENGTH,
    MAX_SAFE_BUILD_LENGTH,
    MAX_LENGTH
  } = require_constants();
  var debug = require_debug();
  exports = module.exports = {};
  var re = exports.re = [];
  var safeRe = exports.safeRe = [];
  var src = exports.src = [];
  var safeSrc = exports.safeSrc = [];
  var t = exports.t = {};
  var R = 0;
  var LETTERDASHNUMBER = "[a-zA-Z0-9-]";
  var safeRegexReplacements = [
    ["\\s", 1],
    ["\\d", MAX_LENGTH],
    [LETTERDASHNUMBER, MAX_SAFE_BUILD_LENGTH]
  ];
  var makeSafeRegex = (value) => {
    for (const [token, max] of safeRegexReplacements) {
      value = value.split(`${token}*`).join(`${token}{0,${max}}`).split(`${token}+`).join(`${token}{1,${max}}`);
    }
    return value;
  };
  var createToken = (name, value, isGlobal) => {
    const safe = makeSafeRegex(value);
    const index = R++;
    debug(name, index, value);
    t[name] = index;
    src[index] = value;
    safeSrc[index] = safe;
    re[index] = new RegExp(value, isGlobal ? "g" : undefined);
    safeRe[index] = new RegExp(safe, isGlobal ? "g" : undefined);
  };
  createToken("NUMERICIDENTIFIER", "0|[1-9]\\d*");
  createToken("NUMERICIDENTIFIERLOOSE", "\\d+");
  createToken("NONNUMERICIDENTIFIER", `\\d*[a-zA-Z-]${LETTERDASHNUMBER}*`);
  createToken("MAINVERSION", `(${src[t.NUMERICIDENTIFIER]})\\.` + `(${src[t.NUMERICIDENTIFIER]})\\.` + `(${src[t.NUMERICIDENTIFIER]})`);
  createToken("MAINVERSIONLOOSE", `(${src[t.NUMERICIDENTIFIERLOOSE]})\\.` + `(${src[t.NUMERICIDENTIFIERLOOSE]})\\.` + `(${src[t.NUMERICIDENTIFIERLOOSE]})`);
  createToken("PRERELEASEIDENTIFIER", `(?:${src[t.NONNUMERICIDENTIFIER]}|${src[t.NUMERICIDENTIFIER]})`);
  createToken("PRERELEASEIDENTIFIERLOOSE", `(?:${src[t.NONNUMERICIDENTIFIER]}|${src[t.NUMERICIDENTIFIERLOOSE]})`);
  createToken("PRERELEASE", `(?:-(${src[t.PRERELEASEIDENTIFIER]}(?:\\.${src[t.PRERELEASEIDENTIFIER]})*))`);
  createToken("PRERELEASELOOSE", `(?:-?(${src[t.PRERELEASEIDENTIFIERLOOSE]}(?:\\.${src[t.PRERELEASEIDENTIFIERLOOSE]})*))`);
  createToken("BUILDIDENTIFIER", `${LETTERDASHNUMBER}+`);
  createToken("BUILD", `(?:\\+(${src[t.BUILDIDENTIFIER]}(?:\\.${src[t.BUILDIDENTIFIER]})*))`);
  createToken("FULLPLAIN", `v?${src[t.MAINVERSION]}${src[t.PRERELEASE]}?${src[t.BUILD]}?`);
  createToken("FULL", `^${src[t.FULLPLAIN]}$`);
  createToken("LOOSEPLAIN", `[v=\\s]*${src[t.MAINVERSIONLOOSE]}${src[t.PRERELEASELOOSE]}?${src[t.BUILD]}?`);
  createToken("LOOSE", `^${src[t.LOOSEPLAIN]}$`);
  createToken("GTLT", "((?:<|>)?=?)");
  createToken("XRANGEIDENTIFIERLOOSE", `${src[t.NUMERICIDENTIFIERLOOSE]}|x|X|\\*`);
  createToken("XRANGEIDENTIFIER", `${src[t.NUMERICIDENTIFIER]}|x|X|\\*`);
  createToken("XRANGEPLAIN", `[v=\\s]*(${src[t.XRANGEIDENTIFIER]})` + `(?:\\.(${src[t.XRANGEIDENTIFIER]})` + `(?:\\.(${src[t.XRANGEIDENTIFIER]})` + `(?:${src[t.PRERELEASE]})?${src[t.BUILD]}?` + `)?)?`);
  createToken("XRANGEPLAINLOOSE", `[v=\\s]*(${src[t.XRANGEIDENTIFIERLOOSE]})` + `(?:\\.(${src[t.XRANGEIDENTIFIERLOOSE]})` + `(?:\\.(${src[t.XRANGEIDENTIFIERLOOSE]})` + `(?:${src[t.PRERELEASELOOSE]})?${src[t.BUILD]}?` + `)?)?`);
  createToken("XRANGE", `^${src[t.GTLT]}\\s*${src[t.XRANGEPLAIN]}$`);
  createToken("XRANGELOOSE", `^${src[t.GTLT]}\\s*${src[t.XRANGEPLAINLOOSE]}$`);
  createToken("COERCEPLAIN", `${"(^|[^\\d])" + "(\\d{1,"}${MAX_SAFE_COMPONENT_LENGTH}})` + `(?:\\.(\\d{1,${MAX_SAFE_COMPONENT_LENGTH}}))?` + `(?:\\.(\\d{1,${MAX_SAFE_COMPONENT_LENGTH}}))?`);
  createToken("COERCE", `${src[t.COERCEPLAIN]}(?:$|[^\\d])`);
  createToken("COERCEFULL", src[t.COERCEPLAIN] + `(?:${src[t.PRERELEASE]})?` + `(?:${src[t.BUILD]})?` + `(?:$|[^\\d])`);
  createToken("COERCERTL", src[t.COERCE], true);
  createToken("COERCERTLFULL", src[t.COERCEFULL], true);
  createToken("LONETILDE", "(?:~>?)");
  createToken("TILDETRIM", `(\\s*)${src[t.LONETILDE]}\\s+`, true);
  exports.tildeTrimReplace = "$1~";
  createToken("TILDE", `^${src[t.LONETILDE]}${src[t.XRANGEPLAIN]}$`);
  createToken("TILDELOOSE", `^${src[t.LONETILDE]}${src[t.XRANGEPLAINLOOSE]}$`);
  createToken("LONECARET", "(?:\\^)");
  createToken("CARETTRIM", `(\\s*)${src[t.LONECARET]}\\s+`, true);
  exports.caretTrimReplace = "$1^";
  createToken("CARET", `^${src[t.LONECARET]}${src[t.XRANGEPLAIN]}$`);
  createToken("CARETLOOSE", `^${src[t.LONECARET]}${src[t.XRANGEPLAINLOOSE]}$`);
  createToken("COMPARATORLOOSE", `^${src[t.GTLT]}\\s*(${src[t.LOOSEPLAIN]})$|^$`);
  createToken("COMPARATOR", `^${src[t.GTLT]}\\s*(${src[t.FULLPLAIN]})$|^$`);
  createToken("COMPARATORTRIM", `(\\s*)${src[t.GTLT]}\\s*(${src[t.LOOSEPLAIN]}|${src[t.XRANGEPLAIN]})`, true);
  exports.comparatorTrimReplace = "$1$2$3";
  createToken("HYPHENRANGE", `^\\s*(${src[t.XRANGEPLAIN]})` + `\\s+-\\s+` + `(${src[t.XRANGEPLAIN]})` + `\\s*$`);
  createToken("HYPHENRANGELOOSE", `^\\s*(${src[t.XRANGEPLAINLOOSE]})` + `\\s+-\\s+` + `(${src[t.XRANGEPLAINLOOSE]})` + `\\s*$`);
  createToken("STAR", "(<|>)?=?\\s*\\*");
  createToken("GTE0", "^\\s*>=\\s*0\\.0\\.0\\s*$");
  createToken("GTE0PRE", "^\\s*>=\\s*0\\.0\\.0-0\\s*$");
});

// node_modules/semver/internal/parse-options.js
var require_parse_options = __commonJS((exports, module) => {
  var looseOption = Object.freeze({ loose: true });
  var emptyOpts = Object.freeze({});
  var parseOptions = (options) => {
    if (!options) {
      return emptyOpts;
    }
    if (typeof options !== "object") {
      return looseOption;
    }
    return options;
  };
  module.exports = parseOptions;
});

// node_modules/semver/internal/identifiers.js
var require_identifiers = __commonJS((exports, module) => {
  var numeric = /^[0-9]+$/;
  var compareIdentifiers = (a, b) => {
    if (typeof a === "number" && typeof b === "number") {
      return a === b ? 0 : a < b ? -1 : 1;
    }
    const anum = numeric.test(a);
    const bnum = numeric.test(b);
    if (anum && bnum) {
      a = +a;
      b = +b;
    }
    return a === b ? 0 : anum && !bnum ? -1 : bnum && !anum ? 1 : a < b ? -1 : 1;
  };
  var rcompareIdentifiers = (a, b) => compareIdentifiers(b, a);
  module.exports = {
    compareIdentifiers,
    rcompareIdentifiers
  };
});

// node_modules/semver/classes/semver.js
var require_semver = __commonJS((exports, module) => {
  var debug = require_debug();
  var { MAX_LENGTH, MAX_SAFE_INTEGER } = require_constants();
  var { safeRe: re, t } = require_re();
  var parseOptions = require_parse_options();
  var { compareIdentifiers } = require_identifiers();
  var isPrereleaseIdentifier = (prerelease, identifier) => {
    const identifiers = identifier.split(".");
    if (identifiers.length > prerelease.length) {
      return false;
    }
    for (let i = 0;i < identifiers.length; i++) {
      if (compareIdentifiers(prerelease[i], identifiers[i]) !== 0) {
        return false;
      }
    }
    return true;
  };

  class SemVer {
    constructor(version, options) {
      options = parseOptions(options);
      if (version instanceof SemVer) {
        if (version.loose === !!options.loose && version.includePrerelease === !!options.includePrerelease) {
          return version;
        } else {
          version = version.version;
        }
      } else if (typeof version !== "string") {
        throw new TypeError(`Invalid version. Must be a string. Got type "${typeof version}".`);
      }
      if (version.length > MAX_LENGTH) {
        throw new TypeError(`version is longer than ${MAX_LENGTH} characters`);
      }
      debug("SemVer", version, options);
      this.options = options;
      this.loose = !!options.loose;
      this.includePrerelease = !!options.includePrerelease;
      const m = version.trim().match(options.loose ? re[t.LOOSE] : re[t.FULL]);
      if (!m) {
        throw new TypeError(`Invalid Version: ${version}`);
      }
      this.raw = version;
      this.major = +m[1];
      this.minor = +m[2];
      this.patch = +m[3];
      if (this.major > MAX_SAFE_INTEGER || this.major < 0) {
        throw new TypeError("Invalid major version");
      }
      if (this.minor > MAX_SAFE_INTEGER || this.minor < 0) {
        throw new TypeError("Invalid minor version");
      }
      if (this.patch > MAX_SAFE_INTEGER || this.patch < 0) {
        throw new TypeError("Invalid patch version");
      }
      if (!m[4]) {
        this.prerelease = [];
      } else {
        this.prerelease = m[4].split(".").map((id) => {
          if (/^[0-9]+$/.test(id)) {
            const num = +id;
            if (num >= 0 && num < MAX_SAFE_INTEGER) {
              return num;
            }
          }
          return id;
        });
      }
      this.build = m[5] ? m[5].split(".") : [];
      this.format();
    }
    format() {
      this.version = `${this.major}.${this.minor}.${this.patch}`;
      if (this.prerelease.length) {
        this.version += `-${this.prerelease.join(".")}`;
      }
      return this.version;
    }
    toString() {
      return this.version;
    }
    compare(other) {
      debug("SemVer.compare", this.version, this.options, other);
      if (!(other instanceof SemVer)) {
        if (typeof other === "string" && other === this.version) {
          return 0;
        }
        other = new SemVer(other, this.options);
      }
      if (other.version === this.version) {
        return 0;
      }
      return this.compareMain(other) || this.comparePre(other);
    }
    compareMain(other) {
      if (!(other instanceof SemVer)) {
        other = new SemVer(other, this.options);
      }
      if (this.major < other.major) {
        return -1;
      }
      if (this.major > other.major) {
        return 1;
      }
      if (this.minor < other.minor) {
        return -1;
      }
      if (this.minor > other.minor) {
        return 1;
      }
      if (this.patch < other.patch) {
        return -1;
      }
      if (this.patch > other.patch) {
        return 1;
      }
      return 0;
    }
    comparePre(other) {
      if (!(other instanceof SemVer)) {
        other = new SemVer(other, this.options);
      }
      if (this.prerelease.length && !other.prerelease.length) {
        return -1;
      } else if (!this.prerelease.length && other.prerelease.length) {
        return 1;
      } else if (!this.prerelease.length && !other.prerelease.length) {
        return 0;
      }
      let i = 0;
      do {
        const a = this.prerelease[i];
        const b = other.prerelease[i];
        debug("prerelease compare", i, a, b);
        if (a === undefined && b === undefined) {
          return 0;
        } else if (b === undefined) {
          return 1;
        } else if (a === undefined) {
          return -1;
        } else if (a === b) {
          continue;
        } else {
          return compareIdentifiers(a, b);
        }
      } while (++i);
    }
    compareBuild(other) {
      if (!(other instanceof SemVer)) {
        other = new SemVer(other, this.options);
      }
      let i = 0;
      do {
        const a = this.build[i];
        const b = other.build[i];
        debug("build compare", i, a, b);
        if (a === undefined && b === undefined) {
          return 0;
        } else if (b === undefined) {
          return 1;
        } else if (a === undefined) {
          return -1;
        } else if (a === b) {
          continue;
        } else {
          return compareIdentifiers(a, b);
        }
      } while (++i);
    }
    inc(release, identifier, identifierBase) {
      if (release.startsWith("pre")) {
        if (!identifier && identifierBase === false) {
          throw new Error("invalid increment argument: identifier is empty");
        }
        if (identifier) {
          const match = `-${identifier}`.match(this.options.loose ? re[t.PRERELEASELOOSE] : re[t.PRERELEASE]);
          if (!match || match[1] !== identifier) {
            throw new Error(`invalid identifier: ${identifier}`);
          }
        }
      }
      switch (release) {
        case "premajor":
          this.prerelease.length = 0;
          this.patch = 0;
          this.minor = 0;
          this.major++;
          this.inc("pre", identifier, identifierBase);
          break;
        case "preminor":
          this.prerelease.length = 0;
          this.patch = 0;
          this.minor++;
          this.inc("pre", identifier, identifierBase);
          break;
        case "prepatch":
          this.prerelease.length = 0;
          this.inc("patch", identifier, identifierBase);
          this.inc("pre", identifier, identifierBase);
          break;
        case "prerelease":
          if (this.prerelease.length === 0) {
            this.inc("patch", identifier, identifierBase);
          }
          this.inc("pre", identifier, identifierBase);
          break;
        case "release":
          if (this.prerelease.length === 0) {
            throw new Error(`version ${this.raw} is not a prerelease`);
          }
          this.prerelease.length = 0;
          break;
        case "major":
          if (this.minor !== 0 || this.patch !== 0 || this.prerelease.length === 0) {
            this.major++;
          }
          this.minor = 0;
          this.patch = 0;
          this.prerelease = [];
          break;
        case "minor":
          if (this.patch !== 0 || this.prerelease.length === 0) {
            this.minor++;
          }
          this.patch = 0;
          this.prerelease = [];
          break;
        case "patch":
          if (this.prerelease.length === 0) {
            this.patch++;
          }
          this.prerelease = [];
          break;
        case "pre": {
          const base = Number(identifierBase) ? 1 : 0;
          if (this.prerelease.length === 0) {
            this.prerelease = [base];
          } else {
            let i = this.prerelease.length;
            while (--i >= 0) {
              if (typeof this.prerelease[i] === "number") {
                this.prerelease[i]++;
                i = -2;
              }
            }
            if (i === -1) {
              if (identifier === this.prerelease.join(".") && identifierBase === false) {
                throw new Error("invalid increment argument: identifier already exists");
              }
              this.prerelease.push(base);
            }
          }
          if (identifier) {
            let prerelease = [identifier, base];
            if (identifierBase === false) {
              prerelease = [identifier];
            }
            if (isPrereleaseIdentifier(this.prerelease, identifier)) {
              const prereleaseBase = this.prerelease[identifier.split(".").length];
              if (isNaN(prereleaseBase)) {
                this.prerelease = prerelease;
              }
            } else {
              this.prerelease = prerelease;
            }
          }
          break;
        }
        default:
          throw new Error(`invalid increment argument: ${release}`);
      }
      this.raw = this.format();
      if (this.build.length) {
        this.raw += `+${this.build.join(".")}`;
      }
      return this;
    }
  }
  module.exports = SemVer;
});

// node_modules/semver/functions/parse.js
var require_parse = __commonJS((exports, module) => {
  var SemVer = require_semver();
  var parse = (version, options, throwErrors = false) => {
    if (version instanceof SemVer) {
      return version;
    }
    try {
      return new SemVer(version, options);
    } catch (er) {
      if (!throwErrors) {
        return null;
      }
      throw er;
    }
  };
  module.exports = parse;
});

// node_modules/semver/functions/valid.js
var require_valid = __commonJS((exports, module) => {
  var parse = require_parse();
  var valid = (version, options) => {
    const v = parse(version, options);
    return v ? v.version : null;
  };
  module.exports = valid;
});

// node_modules/semver/functions/clean.js
var require_clean = __commonJS((exports, module) => {
  var parse = require_parse();
  var clean = (version, options) => {
    const s = parse(version.trim().replace(/^[=v]+/, ""), options);
    return s ? s.version : null;
  };
  module.exports = clean;
});

// node_modules/semver/functions/inc.js
var require_inc = __commonJS((exports, module) => {
  var SemVer = require_semver();
  var inc = (version, release, options, identifier, identifierBase) => {
    if (typeof options === "string") {
      identifierBase = identifier;
      identifier = options;
      options = undefined;
    }
    try {
      return new SemVer(version instanceof SemVer ? version.version : version, options).inc(release, identifier, identifierBase).version;
    } catch (er) {
      return null;
    }
  };
  module.exports = inc;
});

// node_modules/semver/functions/diff.js
var require_diff = __commonJS((exports, module) => {
  var parse = require_parse();
  var diff = (version1, version2) => {
    const v1 = parse(version1, null, true);
    const v2 = parse(version2, null, true);
    const comparison = v1.compare(v2);
    if (comparison === 0) {
      return null;
    }
    const v1Higher = comparison > 0;
    const highVersion = v1Higher ? v1 : v2;
    const lowVersion = v1Higher ? v2 : v1;
    const highHasPre = !!highVersion.prerelease.length;
    const lowHasPre = !!lowVersion.prerelease.length;
    if (lowHasPre && !highHasPre) {
      if (!lowVersion.patch && !lowVersion.minor) {
        return "major";
      }
      if (lowVersion.compareMain(highVersion) === 0) {
        if (lowVersion.minor && !lowVersion.patch) {
          return "minor";
        }
        return "patch";
      }
    }
    const prefix = highHasPre ? "pre" : "";
    if (v1.major !== v2.major) {
      return prefix + "major";
    }
    if (v1.minor !== v2.minor) {
      return prefix + "minor";
    }
    if (v1.patch !== v2.patch) {
      return prefix + "patch";
    }
    return "prerelease";
  };
  module.exports = diff;
});

// node_modules/semver/functions/major.js
var require_major = __commonJS((exports, module) => {
  var SemVer = require_semver();
  var major = (a, loose) => new SemVer(a, loose).major;
  module.exports = major;
});

// node_modules/semver/functions/minor.js
var require_minor = __commonJS((exports, module) => {
  var SemVer = require_semver();
  var minor = (a, loose) => new SemVer(a, loose).minor;
  module.exports = minor;
});

// node_modules/semver/functions/patch.js
var require_patch = __commonJS((exports, module) => {
  var SemVer = require_semver();
  var patch = (a, loose) => new SemVer(a, loose).patch;
  module.exports = patch;
});

// node_modules/semver/functions/prerelease.js
var require_prerelease = __commonJS((exports, module) => {
  var parse = require_parse();
  var prerelease = (version, options) => {
    const parsed = parse(version, options);
    return parsed && parsed.prerelease.length ? parsed.prerelease : null;
  };
  module.exports = prerelease;
});

// node_modules/semver/functions/compare.js
var require_compare = __commonJS((exports, module) => {
  var SemVer = require_semver();
  var compare = (a, b, loose) => new SemVer(a, loose).compare(new SemVer(b, loose));
  module.exports = compare;
});

// node_modules/semver/functions/rcompare.js
var require_rcompare = __commonJS((exports, module) => {
  var compare = require_compare();
  var rcompare = (a, b, loose) => compare(b, a, loose);
  module.exports = rcompare;
});

// node_modules/semver/functions/compare-loose.js
var require_compare_loose = __commonJS((exports, module) => {
  var compare = require_compare();
  var compareLoose = (a, b) => compare(a, b, true);
  module.exports = compareLoose;
});

// node_modules/semver/functions/compare-build.js
var require_compare_build = __commonJS((exports, module) => {
  var SemVer = require_semver();
  var compareBuild = (a, b, loose) => {
    const versionA = new SemVer(a, loose);
    const versionB = new SemVer(b, loose);
    return versionA.compare(versionB) || versionA.compareBuild(versionB);
  };
  module.exports = compareBuild;
});

// node_modules/semver/functions/sort.js
var require_sort = __commonJS((exports, module) => {
  var compareBuild = require_compare_build();
  var sort = (list, loose) => list.sort((a, b) => compareBuild(a, b, loose));
  module.exports = sort;
});

// node_modules/semver/functions/rsort.js
var require_rsort = __commonJS((exports, module) => {
  var compareBuild = require_compare_build();
  var rsort = (list, loose) => list.sort((a, b) => compareBuild(b, a, loose));
  module.exports = rsort;
});

// node_modules/semver/functions/gt.js
var require_gt = __commonJS((exports, module) => {
  var compare = require_compare();
  var gt = (a, b, loose) => compare(a, b, loose) > 0;
  module.exports = gt;
});

// node_modules/semver/functions/lt.js
var require_lt = __commonJS((exports, module) => {
  var compare = require_compare();
  var lt = (a, b, loose) => compare(a, b, loose) < 0;
  module.exports = lt;
});

// node_modules/semver/functions/eq.js
var require_eq = __commonJS((exports, module) => {
  var compare = require_compare();
  var eq = (a, b, loose) => compare(a, b, loose) === 0;
  module.exports = eq;
});

// node_modules/semver/functions/neq.js
var require_neq = __commonJS((exports, module) => {
  var compare = require_compare();
  var neq = (a, b, loose) => compare(a, b, loose) !== 0;
  module.exports = neq;
});

// node_modules/semver/functions/gte.js
var require_gte = __commonJS((exports, module) => {
  var compare = require_compare();
  var gte = (a, b, loose) => compare(a, b, loose) >= 0;
  module.exports = gte;
});

// node_modules/semver/functions/lte.js
var require_lte = __commonJS((exports, module) => {
  var compare = require_compare();
  var lte = (a, b, loose) => compare(a, b, loose) <= 0;
  module.exports = lte;
});

// node_modules/semver/functions/cmp.js
var require_cmp = __commonJS((exports, module) => {
  var eq = require_eq();
  var neq = require_neq();
  var gt = require_gt();
  var gte = require_gte();
  var lt = require_lt();
  var lte = require_lte();
  var cmp = (a, op, b, loose) => {
    switch (op) {
      case "===":
        if (typeof a === "object") {
          a = a.version;
        }
        if (typeof b === "object") {
          b = b.version;
        }
        return a === b;
      case "!==":
        if (typeof a === "object") {
          a = a.version;
        }
        if (typeof b === "object") {
          b = b.version;
        }
        return a !== b;
      case "":
      case "=":
      case "==":
        return eq(a, b, loose);
      case "!=":
        return neq(a, b, loose);
      case ">":
        return gt(a, b, loose);
      case ">=":
        return gte(a, b, loose);
      case "<":
        return lt(a, b, loose);
      case "<=":
        return lte(a, b, loose);
      default:
        throw new TypeError(`Invalid operator: ${op}`);
    }
  };
  module.exports = cmp;
});

// node_modules/semver/functions/coerce.js
var require_coerce = __commonJS((exports, module) => {
  var SemVer = require_semver();
  var parse = require_parse();
  var { safeRe: re, t } = require_re();
  var coerce = (version, options) => {
    if (version instanceof SemVer) {
      return version;
    }
    if (typeof version === "number") {
      version = String(version);
    }
    if (typeof version !== "string") {
      return null;
    }
    options = options || {};
    let match = null;
    if (!options.rtl) {
      match = version.match(options.includePrerelease ? re[t.COERCEFULL] : re[t.COERCE]);
    } else {
      const coerceRtlRegex = options.includePrerelease ? re[t.COERCERTLFULL] : re[t.COERCERTL];
      let next;
      while ((next = coerceRtlRegex.exec(version)) && (!match || match.index + match[0].length !== version.length)) {
        if (!match || next.index + next[0].length !== match.index + match[0].length) {
          match = next;
        }
        coerceRtlRegex.lastIndex = next.index + next[1].length + next[2].length;
      }
      coerceRtlRegex.lastIndex = -1;
    }
    if (match === null) {
      return null;
    }
    const major = match[2];
    const minor = match[3] || "0";
    const patch = match[4] || "0";
    const prerelease = options.includePrerelease && match[5] ? `-${match[5]}` : "";
    const build = options.includePrerelease && match[6] ? `+${match[6]}` : "";
    return parse(`${major}.${minor}.${patch}${prerelease}${build}`, options);
  };
  module.exports = coerce;
});

// node_modules/semver/functions/truncate.js
var require_truncate = __commonJS((exports, module) => {
  var parse = require_parse();
  var constants = require_constants();
  var SemVer = require_semver();
  var truncate = (version, truncation, options) => {
    if (!constants.RELEASE_TYPES.includes(truncation)) {
      return null;
    }
    const clonedVersion = cloneInputVersion(version, options);
    return clonedVersion && doTruncation(clonedVersion, truncation);
  };
  var cloneInputVersion = (version, options) => {
    const versionStringToParse = version instanceof SemVer ? version.version : version;
    return parse(versionStringToParse, options);
  };
  var doTruncation = (version, truncation) => {
    if (isPrerelease(truncation)) {
      return version.version;
    }
    version.prerelease = [];
    switch (truncation) {
      case "major":
        version.minor = 0;
        version.patch = 0;
        break;
      case "minor":
        version.patch = 0;
        break;
    }
    return version.format();
  };
  var isPrerelease = (type) => {
    return type.startsWith("pre");
  };
  module.exports = truncate;
});

// node_modules/semver/internal/lrucache.js
var require_lrucache = __commonJS((exports, module) => {
  class LRUCache {
    constructor() {
      this.max = 1000;
      this.map = new Map;
    }
    get(key) {
      const value = this.map.get(key);
      if (value === undefined) {
        return;
      } else {
        this.map.delete(key);
        this.map.set(key, value);
        return value;
      }
    }
    delete(key) {
      return this.map.delete(key);
    }
    set(key, value) {
      const deleted = this.delete(key);
      if (!deleted && value !== undefined) {
        if (this.map.size >= this.max) {
          const firstKey = this.map.keys().next().value;
          this.delete(firstKey);
        }
        this.map.set(key, value);
      }
      return this;
    }
  }
  module.exports = LRUCache;
});

// node_modules/semver/classes/range.js
var require_range = __commonJS((exports, module) => {
  var SPACE_CHARACTERS = /\s+/g;

  class Range {
    constructor(range, options) {
      options = parseOptions(options);
      if (range instanceof Range) {
        if (range.loose === !!options.loose && range.includePrerelease === !!options.includePrerelease) {
          return range;
        } else {
          return new Range(range.raw, options);
        }
      }
      if (range instanceof Comparator) {
        this.raw = range.value;
        this.set = [[range]];
        this.formatted = undefined;
        return this;
      }
      this.options = options;
      this.loose = !!options.loose;
      this.includePrerelease = !!options.includePrerelease;
      this.raw = range.trim().replace(SPACE_CHARACTERS, " ");
      this.set = this.raw.split("||").map((r) => this.parseRange(r.trim())).filter((c) => c.length);
      if (!this.set.length) {
        throw new TypeError(`Invalid SemVer Range: ${this.raw}`);
      }
      if (this.set.length > 1) {
        const first = this.set[0];
        this.set = this.set.filter((c) => !isNullSet(c[0]));
        if (this.set.length === 0) {
          this.set = [first];
        } else if (this.set.length > 1) {
          for (const c of this.set) {
            if (c.length === 1 && isAny(c[0])) {
              this.set = [c];
              break;
            }
          }
        }
      }
      this.formatted = undefined;
    }
    get range() {
      if (this.formatted === undefined) {
        this.formatted = "";
        for (let i = 0;i < this.set.length; i++) {
          if (i > 0) {
            this.formatted += "||";
          }
          const comps = this.set[i];
          for (let k = 0;k < comps.length; k++) {
            if (k > 0) {
              this.formatted += " ";
            }
            this.formatted += comps[k].toString().trim();
          }
        }
      }
      return this.formatted;
    }
    format() {
      return this.range;
    }
    toString() {
      return this.range;
    }
    parseRange(range) {
      range = range.replace(BUILDSTRIPRE, "");
      const memoOpts = (this.options.includePrerelease && FLAG_INCLUDE_PRERELEASE) | (this.options.loose && FLAG_LOOSE);
      const memoKey = memoOpts + ":" + range;
      const cached = cache.get(memoKey);
      if (cached) {
        return cached;
      }
      const loose = this.options.loose;
      const hr = loose ? re[t.HYPHENRANGELOOSE] : re[t.HYPHENRANGE];
      range = range.replace(hr, hyphenReplace(this.options.includePrerelease));
      debug("hyphen replace", range);
      range = range.replace(re[t.COMPARATORTRIM], comparatorTrimReplace);
      debug("comparator trim", range);
      range = range.replace(re[t.TILDETRIM], tildeTrimReplace);
      debug("tilde trim", range);
      range = range.replace(re[t.CARETTRIM], caretTrimReplace);
      debug("caret trim", range);
      let rangeList = range.split(" ").map((comp) => parseComparator(comp, this.options)).join(" ").split(/\s+/).map((comp) => replaceGTE0(comp, this.options));
      if (loose) {
        rangeList = rangeList.filter((comp) => {
          debug("loose invalid filter", comp, this.options);
          return !!comp.match(re[t.COMPARATORLOOSE]);
        });
      }
      debug("range list", rangeList);
      const rangeMap = new Map;
      const comparators = rangeList.map((comp) => new Comparator(comp, this.options));
      for (const comp of comparators) {
        if (isNullSet(comp)) {
          return [comp];
        }
        rangeMap.set(comp.value, comp);
      }
      if (rangeMap.size > 1 && rangeMap.has("")) {
        rangeMap.delete("");
      }
      const result = [...rangeMap.values()];
      cache.set(memoKey, result);
      return result;
    }
    intersects(range, options) {
      if (!(range instanceof Range)) {
        throw new TypeError("a Range is required");
      }
      return this.set.some((thisComparators) => {
        return isSatisfiable(thisComparators, options) && range.set.some((rangeComparators) => {
          return isSatisfiable(rangeComparators, options) && thisComparators.every((thisComparator) => {
            return rangeComparators.every((rangeComparator) => {
              return thisComparator.intersects(rangeComparator, options);
            });
          });
        });
      });
    }
    test(version) {
      if (!version) {
        return false;
      }
      if (typeof version === "string") {
        try {
          version = new SemVer(version, this.options);
        } catch (er) {
          return false;
        }
      }
      for (let i = 0;i < this.set.length; i++) {
        if (testSet(this.set[i], version, this.options)) {
          return true;
        }
      }
      return false;
    }
  }
  module.exports = Range;
  var LRU = require_lrucache();
  var cache = new LRU;
  var parseOptions = require_parse_options();
  var Comparator = require_comparator();
  var debug = require_debug();
  var SemVer = require_semver();
  var {
    safeRe: re,
    src,
    t,
    comparatorTrimReplace,
    tildeTrimReplace,
    caretTrimReplace
  } = require_re();
  var { FLAG_INCLUDE_PRERELEASE, FLAG_LOOSE } = require_constants();
  var BUILDSTRIPRE = new RegExp(src[t.BUILD], "g");
  var isNullSet = (c) => c.value === "<0.0.0-0";
  var isAny = (c) => c.value === "";
  var isSatisfiable = (comparators, options) => {
    let result = true;
    const remainingComparators = comparators.slice();
    let testComparator = remainingComparators.pop();
    while (result && remainingComparators.length) {
      result = remainingComparators.every((otherComparator) => {
        return testComparator.intersects(otherComparator, options);
      });
      testComparator = remainingComparators.pop();
    }
    return result;
  };
  var parseComparator = (comp, options) => {
    comp = comp.replace(re[t.BUILD], "");
    debug("comp", comp, options);
    comp = replaceCarets(comp, options);
    debug("caret", comp);
    comp = replaceTildes(comp, options);
    debug("tildes", comp);
    comp = replaceXRanges(comp, options);
    debug("xrange", comp);
    comp = replaceStars(comp, options);
    debug("stars", comp);
    return comp;
  };
  var isX = (id) => !id || id.toLowerCase() === "x" || id === "*";
  var invalidXRangeOrder = (M, m, p) => isX(M) && !isX(m) || isX(m) && p && !isX(p);
  var replaceTildes = (comp, options) => {
    return comp.trim().split(/\s+/).map((c) => replaceTilde(c, options)).join(" ");
  };
  var replaceTilde = (comp, options) => {
    const r = options.loose ? re[t.TILDELOOSE] : re[t.TILDE];
    const z = options.includePrerelease ? "-0" : "";
    return comp.replace(r, (_, M, m, p, pr) => {
      debug("tilde", comp, _, M, m, p, pr);
      let ret;
      if (isX(M)) {
        ret = "";
      } else if (isX(m)) {
        ret = `>=${M}.0.0${z} <${+M + 1}.0.0-0`;
      } else if (isX(p)) {
        ret = `>=${M}.${m}.0${z} <${M}.${+m + 1}.0-0`;
      } else if (pr) {
        debug("replaceTilde pr", pr);
        ret = `>=${M}.${m}.${p}-${pr} <${M}.${+m + 1}.0-0`;
      } else {
        ret = `>=${M}.${m}.${p} <${M}.${+m + 1}.0-0`;
      }
      debug("tilde return", ret);
      return ret;
    });
  };
  var replaceCarets = (comp, options) => {
    return comp.trim().split(/\s+/).map((c) => replaceCaret(c, options)).join(" ");
  };
  var replaceCaret = (comp, options) => {
    debug("caret", comp, options);
    const r = options.loose ? re[t.CARETLOOSE] : re[t.CARET];
    const z = options.includePrerelease ? "-0" : "";
    return comp.replace(r, (_, M, m, p, pr) => {
      debug("caret", comp, _, M, m, p, pr);
      let ret;
      if (isX(M)) {
        ret = "";
      } else if (isX(m)) {
        ret = `>=${M}.0.0${z} <${+M + 1}.0.0-0`;
      } else if (isX(p)) {
        if (M === "0") {
          ret = `>=${M}.${m}.0${z} <${M}.${+m + 1}.0-0`;
        } else {
          ret = `>=${M}.${m}.0${z} <${+M + 1}.0.0-0`;
        }
      } else if (pr) {
        debug("replaceCaret pr", pr);
        if (M === "0") {
          if (m === "0") {
            ret = `>=${M}.${m}.${p}-${pr} <${M}.${m}.${+p + 1}-0`;
          } else {
            ret = `>=${M}.${m}.${p}-${pr} <${M}.${+m + 1}.0-0`;
          }
        } else {
          ret = `>=${M}.${m}.${p}-${pr} <${+M + 1}.0.0-0`;
        }
      } else {
        debug("no pr");
        if (M === "0") {
          if (m === "0") {
            ret = `>=${M}.${m}.${p} <${M}.${m}.${+p + 1}-0`;
          } else {
            ret = `>=${M}.${m}.${p} <${M}.${+m + 1}.0-0`;
          }
        } else {
          ret = `>=${M}.${m}.${p} <${+M + 1}.0.0-0`;
        }
      }
      debug("caret return", ret);
      return ret;
    });
  };
  var replaceXRanges = (comp, options) => {
    debug("replaceXRanges", comp, options);
    return comp.split(/\s+/).map((c) => replaceXRange(c, options)).join(" ");
  };
  var replaceXRange = (comp, options) => {
    comp = comp.trim();
    const r = options.loose ? re[t.XRANGELOOSE] : re[t.XRANGE];
    return comp.replace(r, (ret, gtlt, M, m, p, pr) => {
      debug("xRange", comp, ret, gtlt, M, m, p, pr);
      if (invalidXRangeOrder(M, m, p)) {
        return comp;
      }
      const xM = isX(M);
      const xm = xM || isX(m);
      const xp = xm || isX(p);
      const anyX = xp;
      if (gtlt === "=" && anyX) {
        gtlt = "";
      }
      pr = options.includePrerelease ? "-0" : "";
      if (xM) {
        if (gtlt === ">" || gtlt === "<") {
          ret = "<0.0.0-0";
        } else {
          ret = "*";
        }
      } else if (gtlt && anyX) {
        if (xm) {
          m = 0;
        }
        p = 0;
        if (gtlt === ">") {
          gtlt = ">=";
          if (xm) {
            M = +M + 1;
            m = 0;
            p = 0;
          } else {
            m = +m + 1;
            p = 0;
          }
        } else if (gtlt === "<=") {
          gtlt = "<";
          if (xm) {
            M = +M + 1;
          } else {
            m = +m + 1;
          }
        }
        if (gtlt === "<") {
          pr = "-0";
        }
        ret = `${gtlt + M}.${m}.${p}${pr}`;
      } else if (xm) {
        ret = `>=${M}.0.0${pr} <${+M + 1}.0.0-0`;
      } else if (xp) {
        ret = `>=${M}.${m}.0${pr} <${M}.${+m + 1}.0-0`;
      }
      debug("xRange return", ret);
      return ret;
    });
  };
  var replaceStars = (comp, options) => {
    debug("replaceStars", comp, options);
    return comp.trim().replace(re[t.STAR], "");
  };
  var replaceGTE0 = (comp, options) => {
    debug("replaceGTE0", comp, options);
    return comp.trim().replace(re[options.includePrerelease ? t.GTE0PRE : t.GTE0], "");
  };
  var hyphenReplace = (incPr) => ($0, from, fM, fm, fp, fpr, fb, to, tM, tm, tp, tpr) => {
    if (isX(fM)) {
      from = "";
    } else if (isX(fm)) {
      from = `>=${fM}.0.0${incPr ? "-0" : ""}`;
    } else if (isX(fp)) {
      from = `>=${fM}.${fm}.0${incPr ? "-0" : ""}`;
    } else if (fpr) {
      from = `>=${from}`;
    } else {
      from = `>=${from}${incPr ? "-0" : ""}`;
    }
    if (isX(tM)) {
      to = "";
    } else if (isX(tm)) {
      to = `<${+tM + 1}.0.0-0`;
    } else if (isX(tp)) {
      to = `<${tM}.${+tm + 1}.0-0`;
    } else if (tpr) {
      to = `<=${tM}.${tm}.${tp}-${tpr}`;
    } else if (incPr) {
      to = `<${tM}.${tm}.${+tp + 1}-0`;
    } else {
      to = `<=${to}`;
    }
    return `${from} ${to}`.trim();
  };
  var testSet = (set, version, options) => {
    for (let i = 0;i < set.length; i++) {
      if (!set[i].test(version)) {
        return false;
      }
    }
    if (version.prerelease.length && !options.includePrerelease) {
      for (let i = 0;i < set.length; i++) {
        debug(set[i].semver);
        if (set[i].semver === Comparator.ANY) {
          continue;
        }
        if (set[i].semver.prerelease.length > 0) {
          const allowed = set[i].semver;
          if (allowed.major === version.major && allowed.minor === version.minor && allowed.patch === version.patch) {
            return true;
          }
        }
      }
      return false;
    }
    return true;
  };
});

// node_modules/semver/classes/comparator.js
var require_comparator = __commonJS((exports, module) => {
  var ANY = Symbol("SemVer ANY");

  class Comparator {
    static get ANY() {
      return ANY;
    }
    constructor(comp, options) {
      options = parseOptions(options);
      if (comp instanceof Comparator) {
        if (comp.loose === !!options.loose) {
          return comp;
        } else {
          comp = comp.value;
        }
      }
      comp = comp.trim().split(/\s+/).join(" ");
      debug("comparator", comp, options);
      this.options = options;
      this.loose = !!options.loose;
      this.parse(comp);
      if (this.semver === ANY) {
        this.value = "";
      } else {
        this.value = this.operator + this.semver.version;
      }
      debug("comp", this);
    }
    parse(comp) {
      const r = this.options.loose ? re[t.COMPARATORLOOSE] : re[t.COMPARATOR];
      const m = comp.match(r);
      if (!m) {
        throw new TypeError(`Invalid comparator: ${comp}`);
      }
      this.operator = m[1] !== undefined ? m[1] : "";
      if (this.operator === "=") {
        this.operator = "";
      }
      if (!m[2]) {
        this.semver = ANY;
      } else {
        this.semver = new SemVer(m[2], this.options.loose);
      }
    }
    toString() {
      return this.value;
    }
    test(version) {
      debug("Comparator.test", version, this.options.loose);
      if (this.semver === ANY || version === ANY) {
        return true;
      }
      if (typeof version === "string") {
        try {
          version = new SemVer(version, this.options);
        } catch (er) {
          return false;
        }
      }
      return cmp(version, this.operator, this.semver, this.options);
    }
    intersects(comp, options) {
      if (!(comp instanceof Comparator)) {
        throw new TypeError("a Comparator is required");
      }
      if (this.operator === "") {
        if (this.value === "") {
          return true;
        }
        return new Range(comp.value, options).test(this.value);
      } else if (comp.operator === "") {
        if (comp.value === "") {
          return true;
        }
        return new Range(this.value, options).test(comp.semver);
      }
      options = parseOptions(options);
      if (options.includePrerelease && (this.value === "<0.0.0-0" || comp.value === "<0.0.0-0")) {
        return false;
      }
      if (!options.includePrerelease && (this.value.startsWith("<0.0.0") || comp.value.startsWith("<0.0.0"))) {
        return false;
      }
      if (this.operator.startsWith(">") && comp.operator.startsWith(">")) {
        return true;
      }
      if (this.operator.startsWith("<") && comp.operator.startsWith("<")) {
        return true;
      }
      if (this.semver.version === comp.semver.version && this.operator.includes("=") && comp.operator.includes("=")) {
        return true;
      }
      if (cmp(this.semver, "<", comp.semver, options) && this.operator.startsWith(">") && comp.operator.startsWith("<")) {
        return true;
      }
      if (cmp(this.semver, ">", comp.semver, options) && this.operator.startsWith("<") && comp.operator.startsWith(">")) {
        return true;
      }
      return false;
    }
  }
  module.exports = Comparator;
  var parseOptions = require_parse_options();
  var { safeRe: re, t } = require_re();
  var cmp = require_cmp();
  var debug = require_debug();
  var SemVer = require_semver();
  var Range = require_range();
});

// node_modules/semver/functions/satisfies.js
var require_satisfies = __commonJS((exports, module) => {
  var Range = require_range();
  var satisfies = (version, range, options) => {
    try {
      range = new Range(range, options);
    } catch (er) {
      return false;
    }
    return range.test(version);
  };
  module.exports = satisfies;
});

// node_modules/semver/ranges/to-comparators.js
var require_to_comparators = __commonJS((exports, module) => {
  var Range = require_range();
  var toComparators = (range, options) => new Range(range, options).set.map((comp) => comp.map((c) => c.value).join(" ").trim().split(" "));
  module.exports = toComparators;
});

// node_modules/semver/ranges/max-satisfying.js
var require_max_satisfying = __commonJS((exports, module) => {
  var SemVer = require_semver();
  var Range = require_range();
  var maxSatisfying = (versions, range, options) => {
    let max = null;
    let maxSV = null;
    let rangeObj = null;
    try {
      rangeObj = new Range(range, options);
    } catch (er) {
      return null;
    }
    versions.forEach((v) => {
      if (rangeObj.test(v)) {
        if (!max || maxSV.compare(v) === -1) {
          max = v;
          maxSV = new SemVer(max, options);
        }
      }
    });
    return max;
  };
  module.exports = maxSatisfying;
});

// node_modules/semver/ranges/min-satisfying.js
var require_min_satisfying = __commonJS((exports, module) => {
  var SemVer = require_semver();
  var Range = require_range();
  var minSatisfying = (versions, range, options) => {
    let min = null;
    let minSV = null;
    let rangeObj = null;
    try {
      rangeObj = new Range(range, options);
    } catch (er) {
      return null;
    }
    versions.forEach((v) => {
      if (rangeObj.test(v)) {
        if (!min || minSV.compare(v) === 1) {
          min = v;
          minSV = new SemVer(min, options);
        }
      }
    });
    return min;
  };
  module.exports = minSatisfying;
});

// node_modules/semver/ranges/min-version.js
var require_min_version = __commonJS((exports, module) => {
  var SemVer = require_semver();
  var Range = require_range();
  var gt = require_gt();
  var minVersion = (range, loose) => {
    range = new Range(range, loose);
    let minver = new SemVer("0.0.0");
    if (range.test(minver)) {
      return minver;
    }
    minver = new SemVer("0.0.0-0");
    if (range.test(minver)) {
      return minver;
    }
    minver = null;
    for (let i = 0;i < range.set.length; ++i) {
      const comparators = range.set[i];
      let setMin = null;
      comparators.forEach((comparator) => {
        const compver = new SemVer(comparator.semver.version);
        switch (comparator.operator) {
          case ">":
            if (compver.prerelease.length === 0) {
              compver.patch++;
            } else {
              compver.prerelease.push(0);
            }
            compver.raw = compver.format();
          case "":
          case ">=":
            if (!setMin || gt(compver, setMin)) {
              setMin = compver;
            }
            break;
          case "<":
          case "<=":
            break;
          default:
            throw new Error(`Unexpected operation: ${comparator.operator}`);
        }
      });
      if (setMin && (!minver || gt(minver, setMin))) {
        minver = setMin;
      }
    }
    if (minver && range.test(minver)) {
      return minver;
    }
    return null;
  };
  module.exports = minVersion;
});

// node_modules/semver/ranges/valid.js
var require_valid2 = __commonJS((exports, module) => {
  var Range = require_range();
  var validRange = (range, options) => {
    try {
      return new Range(range, options).range || "*";
    } catch (er) {
      return null;
    }
  };
  module.exports = validRange;
});

// node_modules/semver/ranges/outside.js
var require_outside = __commonJS((exports, module) => {
  var SemVer = require_semver();
  var Comparator = require_comparator();
  var { ANY } = Comparator;
  var Range = require_range();
  var satisfies = require_satisfies();
  var gt = require_gt();
  var lt = require_lt();
  var lte = require_lte();
  var gte = require_gte();
  var outside = (version, range, hilo, options) => {
    version = new SemVer(version, options);
    range = new Range(range, options);
    let gtfn, ltefn, ltfn, comp, ecomp;
    switch (hilo) {
      case ">":
        gtfn = gt;
        ltefn = lte;
        ltfn = lt;
        comp = ">";
        ecomp = ">=";
        break;
      case "<":
        gtfn = lt;
        ltefn = gte;
        ltfn = gt;
        comp = "<";
        ecomp = "<=";
        break;
      default:
        throw new TypeError('Must provide a hilo val of "<" or ">"');
    }
    if (satisfies(version, range, options)) {
      return false;
    }
    for (let i = 0;i < range.set.length; ++i) {
      const comparators = range.set[i];
      let high = null;
      let low = null;
      comparators.forEach((comparator) => {
        if (comparator.semver === ANY) {
          comparator = new Comparator(">=0.0.0");
        }
        high = high || comparator;
        low = low || comparator;
        if (gtfn(comparator.semver, high.semver, options)) {
          high = comparator;
        } else if (ltfn(comparator.semver, low.semver, options)) {
          low = comparator;
        }
      });
      if (high.operator === comp || high.operator === ecomp) {
        return false;
      }
      if ((!low.operator || low.operator === comp) && ltefn(version, low.semver)) {
        return false;
      } else if (low.operator === ecomp && ltfn(version, low.semver)) {
        return false;
      }
    }
    return true;
  };
  module.exports = outside;
});

// node_modules/semver/ranges/gtr.js
var require_gtr = __commonJS((exports, module) => {
  var outside = require_outside();
  var gtr = (version, range, options) => outside(version, range, ">", options);
  module.exports = gtr;
});

// node_modules/semver/ranges/ltr.js
var require_ltr = __commonJS((exports, module) => {
  var outside = require_outside();
  var ltr = (version, range, options) => outside(version, range, "<", options);
  module.exports = ltr;
});

// node_modules/semver/ranges/intersects.js
var require_intersects = __commonJS((exports, module) => {
  var Range = require_range();
  var intersects = (r1, r2, options) => {
    r1 = new Range(r1, options);
    r2 = new Range(r2, options);
    return r1.intersects(r2, options);
  };
  module.exports = intersects;
});

// node_modules/semver/ranges/simplify.js
var require_simplify = __commonJS((exports, module) => {
  var satisfies = require_satisfies();
  var compare = require_compare();
  module.exports = (versions, range, options) => {
    const set = [];
    let first = null;
    let prev = null;
    const v = versions.sort((a, b) => compare(a, b, options));
    for (const version of v) {
      const included = satisfies(version, range, options);
      if (included) {
        prev = version;
        if (!first) {
          first = version;
        }
      } else {
        if (prev) {
          set.push([first, prev]);
        }
        prev = null;
        first = null;
      }
    }
    if (first) {
      set.push([first, null]);
    }
    const ranges = [];
    for (const [min, max] of set) {
      if (min === max) {
        ranges.push(min);
      } else if (!max && min === v[0]) {
        ranges.push("*");
      } else if (!max) {
        ranges.push(`>=${min}`);
      } else if (min === v[0]) {
        ranges.push(`<=${max}`);
      } else {
        ranges.push(`${min} - ${max}`);
      }
    }
    const simplified = ranges.join(" || ");
    const original = typeof range.raw === "string" ? range.raw : String(range);
    return simplified.length < original.length ? simplified : range;
  };
});

// node_modules/semver/ranges/subset.js
var require_subset = __commonJS((exports, module) => {
  var Range = require_range();
  var Comparator = require_comparator();
  var { ANY } = Comparator;
  var satisfies = require_satisfies();
  var compare = require_compare();
  var subset = (sub, dom, options = {}) => {
    if (sub === dom) {
      return true;
    }
    sub = new Range(sub, options);
    dom = new Range(dom, options);
    let sawNonNull = false;
    OUTER:
      for (const simpleSub of sub.set) {
        for (const simpleDom of dom.set) {
          const isSub = simpleSubset(simpleSub, simpleDom, options);
          sawNonNull = sawNonNull || isSub !== null;
          if (isSub) {
            continue OUTER;
          }
        }
        if (sawNonNull) {
          return false;
        }
      }
    return true;
  };
  var minimumVersionWithPreRelease = [new Comparator(">=0.0.0-0")];
  var minimumVersion = [new Comparator(">=0.0.0")];
  var simpleSubset = (sub, dom, options) => {
    if (sub === dom) {
      return true;
    }
    if (sub.length === 1 && sub[0].semver === ANY) {
      if (dom.length === 1 && dom[0].semver === ANY) {
        return true;
      } else if (options.includePrerelease) {
        sub = minimumVersionWithPreRelease;
      } else {
        sub = minimumVersion;
      }
    }
    if (dom.length === 1 && dom[0].semver === ANY) {
      if (options.includePrerelease) {
        return true;
      } else {
        dom = minimumVersion;
      }
    }
    const eqSet = new Set;
    let gt, lt;
    for (const c of sub) {
      if (c.operator === ">" || c.operator === ">=") {
        gt = higherGT(gt, c, options);
      } else if (c.operator === "<" || c.operator === "<=") {
        lt = lowerLT(lt, c, options);
      } else {
        eqSet.add(c.semver);
      }
    }
    if (eqSet.size > 1) {
      return null;
    }
    let gtltComp;
    if (gt && lt) {
      gtltComp = compare(gt.semver, lt.semver, options);
      if (gtltComp > 0) {
        return null;
      } else if (gtltComp === 0 && (gt.operator !== ">=" || lt.operator !== "<=")) {
        return null;
      }
    }
    for (const eq of eqSet) {
      if (gt && !satisfies(eq, String(gt), options)) {
        return null;
      }
      if (lt && !satisfies(eq, String(lt), options)) {
        return null;
      }
      for (const c of dom) {
        if (!satisfies(eq, String(c), options)) {
          return false;
        }
      }
      return true;
    }
    let higher, lower;
    let hasDomLT, hasDomGT;
    let needDomLTPre = lt && !options.includePrerelease && lt.semver.prerelease.length ? lt.semver : false;
    let needDomGTPre = gt && !options.includePrerelease && gt.semver.prerelease.length ? gt.semver : false;
    if (needDomLTPre && needDomLTPre.prerelease.length === 1 && lt.operator === "<" && needDomLTPre.prerelease[0] === 0) {
      needDomLTPre = false;
    }
    for (const c of dom) {
      hasDomGT = hasDomGT || c.operator === ">" || c.operator === ">=";
      hasDomLT = hasDomLT || c.operator === "<" || c.operator === "<=";
      if (gt) {
        if (needDomGTPre) {
          if (c.semver.prerelease && c.semver.prerelease.length && c.semver.major === needDomGTPre.major && c.semver.minor === needDomGTPre.minor && c.semver.patch === needDomGTPre.patch) {
            needDomGTPre = false;
          }
        }
        if (c.operator === ">" || c.operator === ">=") {
          higher = higherGT(gt, c, options);
          if (higher === c && higher !== gt) {
            return false;
          }
        } else if (gt.operator === ">=" && !c.test(gt.semver)) {
          return false;
        }
      }
      if (lt) {
        if (needDomLTPre) {
          if (c.semver.prerelease && c.semver.prerelease.length && c.semver.major === needDomLTPre.major && c.semver.minor === needDomLTPre.minor && c.semver.patch === needDomLTPre.patch) {
            needDomLTPre = false;
          }
        }
        if (c.operator === "<" || c.operator === "<=") {
          lower = lowerLT(lt, c, options);
          if (lower === c && lower !== lt) {
            return false;
          }
        } else if (lt.operator === "<=" && !c.test(lt.semver)) {
          return false;
        }
      }
      if (!c.operator && (lt || gt) && gtltComp !== 0) {
        return false;
      }
    }
    if (gt && hasDomLT && !lt && gtltComp !== 0) {
      return false;
    }
    if (lt && hasDomGT && !gt && gtltComp !== 0) {
      return false;
    }
    if (needDomGTPre || needDomLTPre) {
      return false;
    }
    return true;
  };
  var higherGT = (a, b, options) => {
    if (!a) {
      return b;
    }
    const comp = compare(a.semver, b.semver, options);
    return comp > 0 ? a : comp < 0 ? b : b.operator === ">" && a.operator === ">=" ? b : a;
  };
  var lowerLT = (a, b, options) => {
    if (!a) {
      return b;
    }
    const comp = compare(a.semver, b.semver, options);
    return comp < 0 ? a : comp > 0 ? b : b.operator === "<" && a.operator === "<=" ? b : a;
  };
  module.exports = subset;
});

// node_modules/semver/index.js
var require_semver2 = __commonJS((exports, module) => {
  var internalRe = require_re();
  var constants = require_constants();
  var SemVer = require_semver();
  var identifiers = require_identifiers();
  var parse = require_parse();
  var valid = require_valid();
  var clean = require_clean();
  var inc = require_inc();
  var diff = require_diff();
  var major = require_major();
  var minor = require_minor();
  var patch = require_patch();
  var prerelease = require_prerelease();
  var compare = require_compare();
  var rcompare = require_rcompare();
  var compareLoose = require_compare_loose();
  var compareBuild = require_compare_build();
  var sort = require_sort();
  var rsort = require_rsort();
  var gt = require_gt();
  var lt = require_lt();
  var eq = require_eq();
  var neq = require_neq();
  var gte = require_gte();
  var lte = require_lte();
  var cmp = require_cmp();
  var coerce = require_coerce();
  var truncate = require_truncate();
  var Comparator = require_comparator();
  var Range = require_range();
  var satisfies = require_satisfies();
  var toComparators = require_to_comparators();
  var maxSatisfying = require_max_satisfying();
  var minSatisfying = require_min_satisfying();
  var minVersion = require_min_version();
  var validRange = require_valid2();
  var outside = require_outside();
  var gtr = require_gtr();
  var ltr = require_ltr();
  var intersects = require_intersects();
  var simplifyRange = require_simplify();
  var subset = require_subset();
  module.exports = {
    parse,
    valid,
    clean,
    inc,
    diff,
    major,
    minor,
    patch,
    prerelease,
    compare,
    rcompare,
    compareLoose,
    compareBuild,
    sort,
    rsort,
    gt,
    lt,
    eq,
    neq,
    gte,
    lte,
    cmp,
    coerce,
    truncate,
    Comparator,
    Range,
    satisfies,
    toComparators,
    maxSatisfying,
    minSatisfying,
    minVersion,
    validRange,
    outside,
    gtr,
    ltr,
    intersects,
    simplifyRange,
    subset,
    SemVer,
    re: internalRe.re,
    src: internalRe.src,
    tokens: internalRe.t,
    SEMVER_SPEC_VERSION: constants.SEMVER_SPEC_VERSION,
    RELEASE_TYPES: constants.RELEASE_TYPES,
    compareIdentifiers: identifiers.compareIdentifiers,
    rcompareIdentifiers: identifiers.rcompareIdentifiers
  };
});

// node_modules/yaml/dist/nodes/identity.js
var require_identity = __commonJS((exports) => {
  var ALIAS = Symbol.for("yaml.alias");
  var DOC = Symbol.for("yaml.document");
  var MAP = Symbol.for("yaml.map");
  var PAIR = Symbol.for("yaml.pair");
  var SCALAR = Symbol.for("yaml.scalar");
  var SEQ = Symbol.for("yaml.seq");
  var NODE_TYPE = Symbol.for("yaml.node.type");
  var isAlias = (node) => !!node && typeof node === "object" && node[NODE_TYPE] === ALIAS;
  var isDocument = (node) => !!node && typeof node === "object" && node[NODE_TYPE] === DOC;
  var isMap = (node) => !!node && typeof node === "object" && node[NODE_TYPE] === MAP;
  var isPair = (node) => !!node && typeof node === "object" && node[NODE_TYPE] === PAIR;
  var isScalar = (node) => !!node && typeof node === "object" && node[NODE_TYPE] === SCALAR;
  var isSeq = (node) => !!node && typeof node === "object" && node[NODE_TYPE] === SEQ;
  function isCollection(node) {
    if (node && typeof node === "object")
      switch (node[NODE_TYPE]) {
        case MAP:
        case SEQ:
          return true;
      }
    return false;
  }
  function isNode(node) {
    if (node && typeof node === "object")
      switch (node[NODE_TYPE]) {
        case ALIAS:
        case MAP:
        case SCALAR:
        case SEQ:
          return true;
      }
    return false;
  }
  var hasAnchor = (node) => (isScalar(node) || isCollection(node)) && !!node.anchor;
  exports.ALIAS = ALIAS;
  exports.DOC = DOC;
  exports.MAP = MAP;
  exports.NODE_TYPE = NODE_TYPE;
  exports.PAIR = PAIR;
  exports.SCALAR = SCALAR;
  exports.SEQ = SEQ;
  exports.hasAnchor = hasAnchor;
  exports.isAlias = isAlias;
  exports.isCollection = isCollection;
  exports.isDocument = isDocument;
  exports.isMap = isMap;
  exports.isNode = isNode;
  exports.isPair = isPair;
  exports.isScalar = isScalar;
  exports.isSeq = isSeq;
});

// node_modules/yaml/dist/visit.js
var require_visit = __commonJS((exports) => {
  var identity = require_identity();
  var BREAK = Symbol("break visit");
  var SKIP = Symbol("skip children");
  var REMOVE = Symbol("remove node");
  function visit(node, visitor) {
    const visitor_ = initVisitor(visitor);
    if (identity.isDocument(node)) {
      const cd = visit_(null, node.contents, visitor_, Object.freeze([node]));
      if (cd === REMOVE)
        node.contents = null;
    } else
      visit_(null, node, visitor_, Object.freeze([]));
  }
  visit.BREAK = BREAK;
  visit.SKIP = SKIP;
  visit.REMOVE = REMOVE;
  function visit_(key, node, visitor, path) {
    const ctrl = callVisitor(key, node, visitor, path);
    if (identity.isNode(ctrl) || identity.isPair(ctrl)) {
      replaceNode(key, path, ctrl);
      return visit_(key, ctrl, visitor, path);
    }
    if (typeof ctrl !== "symbol") {
      if (identity.isCollection(node)) {
        path = Object.freeze(path.concat(node));
        for (let i = 0;i < node.items.length; ++i) {
          const ci = visit_(i, node.items[i], visitor, path);
          if (typeof ci === "number")
            i = ci - 1;
          else if (ci === BREAK)
            return BREAK;
          else if (ci === REMOVE) {
            node.items.splice(i, 1);
            i -= 1;
          }
        }
      } else if (identity.isPair(node)) {
        path = Object.freeze(path.concat(node));
        const ck = visit_("key", node.key, visitor, path);
        if (ck === BREAK)
          return BREAK;
        else if (ck === REMOVE)
          node.key = null;
        const cv = visit_("value", node.value, visitor, path);
        if (cv === BREAK)
          return BREAK;
        else if (cv === REMOVE)
          node.value = null;
      }
    }
    return ctrl;
  }
  async function visitAsync(node, visitor) {
    const visitor_ = initVisitor(visitor);
    if (identity.isDocument(node)) {
      const cd = await visitAsync_(null, node.contents, visitor_, Object.freeze([node]));
      if (cd === REMOVE)
        node.contents = null;
    } else
      await visitAsync_(null, node, visitor_, Object.freeze([]));
  }
  visitAsync.BREAK = BREAK;
  visitAsync.SKIP = SKIP;
  visitAsync.REMOVE = REMOVE;
  async function visitAsync_(key, node, visitor, path) {
    const ctrl = await callVisitor(key, node, visitor, path);
    if (identity.isNode(ctrl) || identity.isPair(ctrl)) {
      replaceNode(key, path, ctrl);
      return visitAsync_(key, ctrl, visitor, path);
    }
    if (typeof ctrl !== "symbol") {
      if (identity.isCollection(node)) {
        path = Object.freeze(path.concat(node));
        for (let i = 0;i < node.items.length; ++i) {
          const ci = await visitAsync_(i, node.items[i], visitor, path);
          if (typeof ci === "number")
            i = ci - 1;
          else if (ci === BREAK)
            return BREAK;
          else if (ci === REMOVE) {
            node.items.splice(i, 1);
            i -= 1;
          }
        }
      } else if (identity.isPair(node)) {
        path = Object.freeze(path.concat(node));
        const ck = await visitAsync_("key", node.key, visitor, path);
        if (ck === BREAK)
          return BREAK;
        else if (ck === REMOVE)
          node.key = null;
        const cv = await visitAsync_("value", node.value, visitor, path);
        if (cv === BREAK)
          return BREAK;
        else if (cv === REMOVE)
          node.value = null;
      }
    }
    return ctrl;
  }
  function initVisitor(visitor) {
    if (typeof visitor === "object" && (visitor.Collection || visitor.Node || visitor.Value)) {
      return Object.assign({
        Alias: visitor.Node,
        Map: visitor.Node,
        Scalar: visitor.Node,
        Seq: visitor.Node
      }, visitor.Value && {
        Map: visitor.Value,
        Scalar: visitor.Value,
        Seq: visitor.Value
      }, visitor.Collection && {
        Map: visitor.Collection,
        Seq: visitor.Collection
      }, visitor);
    }
    return visitor;
  }
  function callVisitor(key, node, visitor, path) {
    if (typeof visitor === "function")
      return visitor(key, node, path);
    if (identity.isMap(node))
      return visitor.Map?.(key, node, path);
    if (identity.isSeq(node))
      return visitor.Seq?.(key, node, path);
    if (identity.isPair(node))
      return visitor.Pair?.(key, node, path);
    if (identity.isScalar(node))
      return visitor.Scalar?.(key, node, path);
    if (identity.isAlias(node))
      return visitor.Alias?.(key, node, path);
    return;
  }
  function replaceNode(key, path, node) {
    const parent = path[path.length - 1];
    if (identity.isCollection(parent)) {
      parent.items[key] = node;
    } else if (identity.isPair(parent)) {
      if (key === "key")
        parent.key = node;
      else
        parent.value = node;
    } else if (identity.isDocument(parent)) {
      parent.contents = node;
    } else {
      const pt = identity.isAlias(parent) ? "alias" : "scalar";
      throw new Error(`Cannot replace node with ${pt} parent`);
    }
  }
  exports.visit = visit;
  exports.visitAsync = visitAsync;
});

// node_modules/yaml/dist/doc/directives.js
var require_directives = __commonJS((exports) => {
  var identity = require_identity();
  var visit = require_visit();
  var escapeChars = {
    "!": "%21",
    ",": "%2C",
    "[": "%5B",
    "]": "%5D",
    "{": "%7B",
    "}": "%7D"
  };
  var escapeTagName = (tn) => tn.replace(/[!,[\]{}]/g, (ch) => escapeChars[ch]);

  class Directives {
    constructor(yaml, tags) {
      this.docStart = null;
      this.docEnd = false;
      this.yaml = Object.assign({}, Directives.defaultYaml, yaml);
      this.tags = Object.assign({}, Directives.defaultTags, tags);
    }
    clone() {
      const copy = new Directives(this.yaml, this.tags);
      copy.docStart = this.docStart;
      return copy;
    }
    atDocument() {
      const res = new Directives(this.yaml, this.tags);
      switch (this.yaml.version) {
        case "1.1":
          this.atNextDocument = true;
          break;
        case "1.2":
          this.atNextDocument = false;
          this.yaml = {
            explicit: Directives.defaultYaml.explicit,
            version: "1.2"
          };
          this.tags = Object.assign({}, Directives.defaultTags);
          break;
      }
      return res;
    }
    add(line, onError) {
      if (this.atNextDocument) {
        this.yaml = { explicit: Directives.defaultYaml.explicit, version: "1.1" };
        this.tags = Object.assign({}, Directives.defaultTags);
        this.atNextDocument = false;
      }
      const parts = line.trim().split(/[ \t]+/);
      const name = parts.shift();
      switch (name) {
        case "%TAG": {
          if (parts.length !== 2) {
            onError(0, "%TAG directive should contain exactly two parts");
            if (parts.length < 2)
              return false;
          }
          const [handle, prefix] = parts;
          this.tags[handle] = prefix;
          return true;
        }
        case "%YAML": {
          this.yaml.explicit = true;
          if (parts.length !== 1) {
            onError(0, "%YAML directive should contain exactly one part");
            return false;
          }
          const [version] = parts;
          if (version === "1.1" || version === "1.2") {
            this.yaml.version = version;
            return true;
          } else {
            const isValid = /^\d+\.\d+$/.test(version);
            onError(6, `Unsupported YAML version ${version}`, isValid);
            return false;
          }
        }
        default:
          onError(0, `Unknown directive ${name}`, true);
          return false;
      }
    }
    tagName(source, onError) {
      if (source === "!")
        return "!";
      if (source[0] !== "!") {
        onError(`Not a valid tag: ${source}`);
        return null;
      }
      if (source[1] === "<") {
        const verbatim = source.slice(2, -1);
        if (verbatim === "!" || verbatim === "!!") {
          onError(`Verbatim tags aren't resolved, so ${source} is invalid.`);
          return null;
        }
        if (source[source.length - 1] !== ">")
          onError("Verbatim tags must end with a >");
        return verbatim;
      }
      const [, handle, suffix] = source.match(/^(.*!)([^!]*)$/s);
      if (!suffix)
        onError(`The ${source} tag has no suffix`);
      const prefix = this.tags[handle];
      if (prefix) {
        try {
          return prefix + decodeURIComponent(suffix);
        } catch (error) {
          onError(String(error));
          return null;
        }
      }
      if (handle === "!")
        return source;
      onError(`Could not resolve tag: ${source}`);
      return null;
    }
    tagString(tag) {
      for (const [handle, prefix] of Object.entries(this.tags)) {
        if (tag.startsWith(prefix))
          return handle + escapeTagName(tag.substring(prefix.length));
      }
      return tag[0] === "!" ? tag : `!<${tag}>`;
    }
    toString(doc) {
      const lines = this.yaml.explicit ? [`%YAML ${this.yaml.version || "1.2"}`] : [];
      const tagEntries = Object.entries(this.tags);
      let tagNames;
      if (doc && tagEntries.length > 0 && identity.isNode(doc.contents)) {
        const tags = {};
        visit.visit(doc.contents, (_key, node) => {
          if (identity.isNode(node) && node.tag)
            tags[node.tag] = true;
        });
        tagNames = Object.keys(tags);
      } else
        tagNames = [];
      for (const [handle, prefix] of tagEntries) {
        if (handle === "!!" && prefix === "tag:yaml.org,2002:")
          continue;
        if (!doc || tagNames.some((tn) => tn.startsWith(prefix)))
          lines.push(`%TAG ${handle} ${prefix}`);
      }
      return lines.join(`
`);
    }
  }
  Directives.defaultYaml = { explicit: false, version: "1.2" };
  Directives.defaultTags = { "!!": "tag:yaml.org,2002:" };
  exports.Directives = Directives;
});

// node_modules/yaml/dist/doc/anchors.js
var require_anchors = __commonJS((exports) => {
  var identity = require_identity();
  var visit = require_visit();
  function anchorIsValid(anchor) {
    if (/[\x00-\x19\s,[\]{}]/.test(anchor)) {
      const sa = JSON.stringify(anchor);
      const msg = `Anchor must not contain whitespace or control characters: ${sa}`;
      throw new Error(msg);
    }
    return true;
  }
  function anchorNames(root) {
    const anchors = new Set;
    visit.visit(root, {
      Value(_key, node) {
        if (node.anchor)
          anchors.add(node.anchor);
      }
    });
    return anchors;
  }
  function findNewAnchor(prefix, exclude) {
    for (let i = 1;; ++i) {
      const name = `${prefix}${i}`;
      if (!exclude.has(name))
        return name;
    }
  }
  function createNodeAnchors(doc, prefix) {
    const aliasObjects = [];
    const sourceObjects = new Map;
    let prevAnchors = null;
    return {
      onAnchor: (source) => {
        aliasObjects.push(source);
        prevAnchors ?? (prevAnchors = anchorNames(doc));
        const anchor = findNewAnchor(prefix, prevAnchors);
        prevAnchors.add(anchor);
        return anchor;
      },
      setAnchors: () => {
        for (const source of aliasObjects) {
          const ref = sourceObjects.get(source);
          if (typeof ref === "object" && ref.anchor && (identity.isScalar(ref.node) || identity.isCollection(ref.node))) {
            ref.node.anchor = ref.anchor;
          } else {
            const error = new Error("Failed to resolve repeated object (this should not happen)");
            error.source = source;
            throw error;
          }
        }
      },
      sourceObjects
    };
  }
  exports.anchorIsValid = anchorIsValid;
  exports.anchorNames = anchorNames;
  exports.createNodeAnchors = createNodeAnchors;
  exports.findNewAnchor = findNewAnchor;
});

// node_modules/yaml/dist/doc/applyReviver.js
var require_applyReviver = __commonJS((exports) => {
  function applyReviver(reviver, obj, key, val) {
    if (val && typeof val === "object") {
      if (Array.isArray(val)) {
        for (let i = 0, len = val.length;i < len; ++i) {
          const v0 = val[i];
          const v1 = applyReviver(reviver, val, String(i), v0);
          if (v1 === undefined)
            delete val[i];
          else if (v1 !== v0)
            val[i] = v1;
        }
      } else if (val instanceof Map) {
        for (const k of Array.from(val.keys())) {
          const v0 = val.get(k);
          const v1 = applyReviver(reviver, val, k, v0);
          if (v1 === undefined)
            val.delete(k);
          else if (v1 !== v0)
            val.set(k, v1);
        }
      } else if (val instanceof Set) {
        for (const v0 of Array.from(val)) {
          const v1 = applyReviver(reviver, val, v0, v0);
          if (v1 === undefined)
            val.delete(v0);
          else if (v1 !== v0) {
            val.delete(v0);
            val.add(v1);
          }
        }
      } else {
        for (const [k, v0] of Object.entries(val)) {
          const v1 = applyReviver(reviver, val, k, v0);
          if (v1 === undefined)
            delete val[k];
          else if (v1 !== v0)
            val[k] = v1;
        }
      }
    }
    return reviver.call(obj, key, val);
  }
  exports.applyReviver = applyReviver;
});

// node_modules/yaml/dist/nodes/toJS.js
var require_toJS = __commonJS((exports) => {
  var identity = require_identity();
  function toJS(value, arg, ctx) {
    if (Array.isArray(value))
      return value.map((v, i) => toJS(v, String(i), ctx));
    if (value && typeof value.toJSON === "function") {
      if (!ctx || !identity.hasAnchor(value))
        return value.toJSON(arg, ctx);
      const data = { aliasCount: 0, count: 1, res: undefined };
      ctx.anchors.set(value, data);
      ctx.onCreate = (res2) => {
        data.res = res2;
        delete ctx.onCreate;
      };
      const res = value.toJSON(arg, ctx);
      if (ctx.onCreate)
        ctx.onCreate(res);
      return res;
    }
    if (typeof value === "bigint" && !ctx?.keep)
      return Number(value);
    return value;
  }
  exports.toJS = toJS;
});

// node_modules/yaml/dist/nodes/Node.js
var require_Node = __commonJS((exports) => {
  var applyReviver = require_applyReviver();
  var identity = require_identity();
  var toJS = require_toJS();

  class NodeBase {
    constructor(type) {
      Object.defineProperty(this, identity.NODE_TYPE, { value: type });
    }
    clone() {
      const copy = Object.create(Object.getPrototypeOf(this), Object.getOwnPropertyDescriptors(this));
      if (this.range)
        copy.range = this.range.slice();
      return copy;
    }
    toJS(doc, { mapAsMap, maxAliasCount, onAnchor, reviver } = {}) {
      if (!identity.isDocument(doc))
        throw new TypeError("A document argument is required");
      const ctx = {
        anchors: new Map,
        doc,
        keep: true,
        mapAsMap: mapAsMap === true,
        mapKeyWarned: false,
        maxAliasCount: typeof maxAliasCount === "number" ? maxAliasCount : 100
      };
      const res = toJS.toJS(this, "", ctx);
      if (typeof onAnchor === "function")
        for (const { count, res: res2 } of ctx.anchors.values())
          onAnchor(res2, count);
      return typeof reviver === "function" ? applyReviver.applyReviver(reviver, { "": res }, "", res) : res;
    }
  }
  exports.NodeBase = NodeBase;
});

// node_modules/yaml/dist/nodes/Alias.js
var require_Alias = __commonJS((exports) => {
  var anchors = require_anchors();
  var visit = require_visit();
  var identity = require_identity();
  var Node = require_Node();
  var toJS = require_toJS();

  class Alias extends Node.NodeBase {
    constructor(source) {
      super(identity.ALIAS);
      this.source = source;
      Object.defineProperty(this, "tag", {
        set() {
          throw new Error("Alias nodes cannot have tags");
        }
      });
    }
    resolve(doc, ctx) {
      if (ctx?.maxAliasCount === 0)
        throw new ReferenceError("Alias resolution is disabled");
      let nodes;
      if (ctx?.aliasResolveCache) {
        nodes = ctx.aliasResolveCache;
      } else {
        nodes = [];
        visit.visit(doc, {
          Node: (_key, node) => {
            if (identity.isAlias(node) || identity.hasAnchor(node))
              nodes.push(node);
          }
        });
        if (ctx)
          ctx.aliasResolveCache = nodes;
      }
      let found = undefined;
      for (const node of nodes) {
        if (node === this)
          break;
        if (node.anchor === this.source)
          found = node;
      }
      return found;
    }
    toJSON(_arg, ctx) {
      if (!ctx)
        return { source: this.source };
      const { anchors: anchors2, doc, maxAliasCount } = ctx;
      const source = this.resolve(doc, ctx);
      if (!source) {
        const msg = `Unresolved alias (the anchor must be set before the alias): ${this.source}`;
        throw new ReferenceError(msg);
      }
      let data = anchors2.get(source);
      if (!data) {
        toJS.toJS(source, null, ctx);
        data = anchors2.get(source);
      }
      if (data?.res === undefined) {
        const msg = "This should not happen: Alias anchor was not resolved?";
        throw new ReferenceError(msg);
      }
      if (maxAliasCount >= 0) {
        data.count += 1;
        if (data.aliasCount === 0)
          data.aliasCount = getAliasCount(doc, source, anchors2);
        if (data.count * data.aliasCount > maxAliasCount) {
          const msg = "Excessive alias count indicates a resource exhaustion attack";
          throw new ReferenceError(msg);
        }
      }
      return data.res;
    }
    toString(ctx, _onComment, _onChompKeep) {
      const src = `*${this.source}`;
      if (ctx) {
        anchors.anchorIsValid(this.source);
        if (ctx.options.verifyAliasOrder && !ctx.anchors.has(this.source)) {
          const msg = `Unresolved alias (the anchor must be set before the alias): ${this.source}`;
          throw new Error(msg);
        }
        if (ctx.implicitKey)
          return `${src} `;
      }
      return src;
    }
  }
  function getAliasCount(doc, node, anchors2) {
    if (identity.isAlias(node)) {
      const source = node.resolve(doc);
      const anchor = anchors2 && source && anchors2.get(source);
      return anchor ? anchor.count * anchor.aliasCount : 0;
    } else if (identity.isCollection(node)) {
      let count = 0;
      for (const item of node.items) {
        const c = getAliasCount(doc, item, anchors2);
        if (c > count)
          count = c;
      }
      return count;
    } else if (identity.isPair(node)) {
      const kc = getAliasCount(doc, node.key, anchors2);
      const vc = getAliasCount(doc, node.value, anchors2);
      return Math.max(kc, vc);
    }
    return 1;
  }
  exports.Alias = Alias;
});

// node_modules/yaml/dist/nodes/Scalar.js
var require_Scalar = __commonJS((exports) => {
  var identity = require_identity();
  var Node = require_Node();
  var toJS = require_toJS();
  var isScalarValue = (value) => !value || typeof value !== "function" && typeof value !== "object";

  class Scalar extends Node.NodeBase {
    constructor(value) {
      super(identity.SCALAR);
      this.value = value;
    }
    toJSON(arg, ctx) {
      return ctx?.keep ? this.value : toJS.toJS(this.value, arg, ctx);
    }
    toString() {
      return String(this.value);
    }
  }
  Scalar.BLOCK_FOLDED = "BLOCK_FOLDED";
  Scalar.BLOCK_LITERAL = "BLOCK_LITERAL";
  Scalar.PLAIN = "PLAIN";
  Scalar.QUOTE_DOUBLE = "QUOTE_DOUBLE";
  Scalar.QUOTE_SINGLE = "QUOTE_SINGLE";
  exports.Scalar = Scalar;
  exports.isScalarValue = isScalarValue;
});

// node_modules/yaml/dist/doc/createNode.js
var require_createNode = __commonJS((exports) => {
  var Alias = require_Alias();
  var identity = require_identity();
  var Scalar = require_Scalar();
  var defaultTagPrefix = "tag:yaml.org,2002:";
  function findTagObject(value, tagName, tags) {
    if (tagName) {
      const match = tags.filter((t) => t.tag === tagName);
      const tagObj = match.find((t) => !t.format) ?? match[0];
      if (!tagObj)
        throw new Error(`Tag ${tagName} not found`);
      return tagObj;
    }
    return tags.find((t) => t.identify?.(value) && !t.format);
  }
  function createNode(value, tagName, ctx) {
    if (identity.isDocument(value))
      value = value.contents;
    if (identity.isNode(value))
      return value;
    if (identity.isPair(value)) {
      const map = ctx.schema[identity.MAP].createNode?.(ctx.schema, null, ctx);
      map.items.push(value);
      return map;
    }
    if (value instanceof String || value instanceof Number || value instanceof Boolean || typeof BigInt !== "undefined" && value instanceof BigInt) {
      value = value.valueOf();
    }
    const { aliasDuplicateObjects, onAnchor, onTagObj, schema, sourceObjects } = ctx;
    let ref = undefined;
    if (aliasDuplicateObjects && value && typeof value === "object") {
      ref = sourceObjects.get(value);
      if (ref) {
        ref.anchor ?? (ref.anchor = onAnchor(value));
        return new Alias.Alias(ref.anchor);
      } else {
        ref = { anchor: null, node: null };
        sourceObjects.set(value, ref);
      }
    }
    if (tagName?.startsWith("!!"))
      tagName = defaultTagPrefix + tagName.slice(2);
    let tagObj = findTagObject(value, tagName, schema.tags);
    if (!tagObj) {
      if (value && typeof value.toJSON === "function") {
        value = value.toJSON();
      }
      if (!value || typeof value !== "object") {
        const node2 = new Scalar.Scalar(value);
        if (ref)
          ref.node = node2;
        return node2;
      }
      tagObj = value instanceof Map ? schema[identity.MAP] : (Symbol.iterator in Object(value)) ? schema[identity.SEQ] : schema[identity.MAP];
    }
    if (onTagObj) {
      onTagObj(tagObj);
      delete ctx.onTagObj;
    }
    const node = tagObj?.createNode ? tagObj.createNode(ctx.schema, value, ctx) : typeof tagObj?.nodeClass?.from === "function" ? tagObj.nodeClass.from(ctx.schema, value, ctx) : new Scalar.Scalar(value);
    if (tagName)
      node.tag = tagName;
    else if (!tagObj.default)
      node.tag = tagObj.tag;
    if (ref)
      ref.node = node;
    return node;
  }
  exports.createNode = createNode;
});

// node_modules/yaml/dist/nodes/Collection.js
var require_Collection = __commonJS((exports) => {
  var createNode = require_createNode();
  var identity = require_identity();
  var Node = require_Node();
  function collectionFromPath(schema, path, value) {
    let v = value;
    for (let i = path.length - 1;i >= 0; --i) {
      const k = path[i];
      if (typeof k === "number" && Number.isInteger(k) && k >= 0) {
        const a = [];
        a[k] = v;
        v = a;
      } else {
        v = new Map([[k, v]]);
      }
    }
    return createNode.createNode(v, undefined, {
      aliasDuplicateObjects: false,
      keepUndefined: false,
      onAnchor: () => {
        throw new Error("This should not happen, please report a bug.");
      },
      schema,
      sourceObjects: new Map
    });
  }
  var isEmptyPath = (path) => path == null || typeof path === "object" && !!path[Symbol.iterator]().next().done;

  class Collection extends Node.NodeBase {
    constructor(type, schema) {
      super(type);
      Object.defineProperty(this, "schema", {
        value: schema,
        configurable: true,
        enumerable: false,
        writable: true
      });
    }
    clone(schema) {
      const copy = Object.create(Object.getPrototypeOf(this), Object.getOwnPropertyDescriptors(this));
      if (schema)
        copy.schema = schema;
      copy.items = copy.items.map((it) => identity.isNode(it) || identity.isPair(it) ? it.clone(schema) : it);
      if (this.range)
        copy.range = this.range.slice();
      return copy;
    }
    addIn(path, value) {
      if (isEmptyPath(path))
        this.add(value);
      else {
        const [key, ...rest] = path;
        const node = this.get(key, true);
        if (identity.isCollection(node))
          node.addIn(rest, value);
        else if (node === undefined && this.schema)
          this.set(key, collectionFromPath(this.schema, rest, value));
        else
          throw new Error(`Expected YAML collection at ${key}. Remaining path: ${rest}`);
      }
    }
    deleteIn(path) {
      const [key, ...rest] = path;
      if (rest.length === 0)
        return this.delete(key);
      const node = this.get(key, true);
      if (identity.isCollection(node))
        return node.deleteIn(rest);
      else
        throw new Error(`Expected YAML collection at ${key}. Remaining path: ${rest}`);
    }
    getIn(path, keepScalar) {
      const [key, ...rest] = path;
      const node = this.get(key, true);
      if (rest.length === 0)
        return !keepScalar && identity.isScalar(node) ? node.value : node;
      else
        return identity.isCollection(node) ? node.getIn(rest, keepScalar) : undefined;
    }
    hasAllNullValues(allowScalar) {
      return this.items.every((node) => {
        if (!identity.isPair(node))
          return false;
        const n = node.value;
        return n == null || allowScalar && identity.isScalar(n) && n.value == null && !n.commentBefore && !n.comment && !n.tag;
      });
    }
    hasIn(path) {
      const [key, ...rest] = path;
      if (rest.length === 0)
        return this.has(key);
      const node = this.get(key, true);
      return identity.isCollection(node) ? node.hasIn(rest) : false;
    }
    setIn(path, value) {
      const [key, ...rest] = path;
      if (rest.length === 0) {
        this.set(key, value);
      } else {
        const node = this.get(key, true);
        if (identity.isCollection(node))
          node.setIn(rest, value);
        else if (node === undefined && this.schema)
          this.set(key, collectionFromPath(this.schema, rest, value));
        else
          throw new Error(`Expected YAML collection at ${key}. Remaining path: ${rest}`);
      }
    }
  }
  exports.Collection = Collection;
  exports.collectionFromPath = collectionFromPath;
  exports.isEmptyPath = isEmptyPath;
});

// node_modules/yaml/dist/stringify/stringifyComment.js
var require_stringifyComment = __commonJS((exports) => {
  var stringifyComment = (str) => str.replace(/^(?!$)(?: $)?/gm, "#");
  function indentComment(comment, indent) {
    if (/^\n+$/.test(comment))
      return comment.substring(1);
    return indent ? comment.replace(/^(?! *$)/gm, indent) : comment;
  }
  var lineComment = (str, indent, comment) => str.endsWith(`
`) ? indentComment(comment, indent) : comment.includes(`
`) ? `
` + indentComment(comment, indent) : (str.endsWith(" ") ? "" : " ") + comment;
  exports.indentComment = indentComment;
  exports.lineComment = lineComment;
  exports.stringifyComment = stringifyComment;
});

// node_modules/yaml/dist/stringify/foldFlowLines.js
var require_foldFlowLines = __commonJS((exports) => {
  var FOLD_FLOW = "flow";
  var FOLD_BLOCK = "block";
  var FOLD_QUOTED = "quoted";
  function foldFlowLines(text, indent, mode = "flow", { indentAtStart, lineWidth = 80, minContentWidth = 20, onFold, onOverflow } = {}) {
    if (!lineWidth || lineWidth < 0)
      return text;
    if (lineWidth < minContentWidth)
      minContentWidth = 0;
    const endStep = Math.max(1 + minContentWidth, 1 + lineWidth - indent.length);
    if (text.length <= endStep)
      return text;
    const folds = [];
    const escapedFolds = {};
    let end = lineWidth - indent.length;
    if (typeof indentAtStart === "number") {
      if (indentAtStart > lineWidth - Math.max(2, minContentWidth))
        folds.push(0);
      else
        end = lineWidth - indentAtStart;
    }
    let split = undefined;
    let prev = undefined;
    let overflow = false;
    let i = -1;
    let escStart = -1;
    let escEnd = -1;
    if (mode === FOLD_BLOCK) {
      i = consumeMoreIndentedLines(text, i, indent.length);
      if (i !== -1)
        end = i + endStep;
    }
    for (let ch;ch = text[i += 1]; ) {
      if (mode === FOLD_QUOTED && ch === "\\") {
        escStart = i;
        switch (text[i + 1]) {
          case "x":
            i += 3;
            break;
          case "u":
            i += 5;
            break;
          case "U":
            i += 9;
            break;
          default:
            i += 1;
        }
        escEnd = i;
      }
      if (ch === `
`) {
        if (mode === FOLD_BLOCK)
          i = consumeMoreIndentedLines(text, i, indent.length);
        end = i + indent.length + endStep;
        split = undefined;
      } else {
        if (ch === " " && prev && prev !== " " && prev !== `
` && prev !== "\t") {
          const next = text[i + 1];
          if (next && next !== " " && next !== `
` && next !== "\t")
            split = i;
        }
        if (i >= end) {
          if (split) {
            folds.push(split);
            end = split + endStep;
            split = undefined;
          } else if (mode === FOLD_QUOTED) {
            while (prev === " " || prev === "\t") {
              prev = ch;
              ch = text[i += 1];
              overflow = true;
            }
            const j = i > escEnd + 1 ? i - 2 : escStart - 1;
            if (escapedFolds[j])
              return text;
            folds.push(j);
            escapedFolds[j] = true;
            end = j + endStep;
            split = undefined;
          } else {
            overflow = true;
          }
        }
      }
      prev = ch;
    }
    if (overflow && onOverflow)
      onOverflow();
    if (folds.length === 0)
      return text;
    if (onFold)
      onFold();
    let res = text.slice(0, folds[0]);
    for (let i2 = 0;i2 < folds.length; ++i2) {
      const fold = folds[i2];
      const end2 = folds[i2 + 1] || text.length;
      if (fold === 0)
        res = `
${indent}${text.slice(0, end2)}`;
      else {
        if (mode === FOLD_QUOTED && escapedFolds[fold])
          res += `${text[fold]}\\`;
        res += `
${indent}${text.slice(fold + 1, end2)}`;
      }
    }
    return res;
  }
  function consumeMoreIndentedLines(text, i, indent) {
    let end = i;
    let start = i + 1;
    let ch = text[start];
    while (ch === " " || ch === "\t") {
      if (i < start + indent) {
        ch = text[++i];
      } else {
        do {
          ch = text[++i];
        } while (ch && ch !== `
`);
        end = i;
        start = i + 1;
        ch = text[start];
      }
    }
    return end;
  }
  exports.FOLD_BLOCK = FOLD_BLOCK;
  exports.FOLD_FLOW = FOLD_FLOW;
  exports.FOLD_QUOTED = FOLD_QUOTED;
  exports.foldFlowLines = foldFlowLines;
});

// node_modules/yaml/dist/stringify/stringifyString.js
var require_stringifyString = __commonJS((exports) => {
  var Scalar = require_Scalar();
  var foldFlowLines = require_foldFlowLines();
  var getFoldOptions = (ctx, isBlock) => ({
    indentAtStart: isBlock ? ctx.indent.length : ctx.indentAtStart,
    lineWidth: ctx.options.lineWidth,
    minContentWidth: ctx.options.minContentWidth
  });
  var containsDocumentMarker = (str) => /^(%|---|\.\.\.)/m.test(str);
  function lineLengthOverLimit(str, lineWidth, indentLength) {
    if (!lineWidth || lineWidth < 0)
      return false;
    const limit = lineWidth - indentLength;
    const strLen = str.length;
    if (strLen <= limit)
      return false;
    for (let i = 0, start = 0;i < strLen; ++i) {
      if (str[i] === `
`) {
        if (i - start > limit)
          return true;
        start = i + 1;
        if (strLen - start <= limit)
          return false;
      }
    }
    return true;
  }
  function doubleQuotedString(value, ctx) {
    const json = JSON.stringify(value);
    if (ctx.options.doubleQuotedAsJSON)
      return json;
    const { implicitKey } = ctx;
    const minMultiLineLength = ctx.options.doubleQuotedMinMultiLineLength;
    const indent = ctx.indent || (containsDocumentMarker(value) ? "  " : "");
    let str = "";
    let start = 0;
    for (let i = 0, ch = json[i];ch; ch = json[++i]) {
      if (ch === " " && json[i + 1] === "\\" && json[i + 2] === "n") {
        str += json.slice(start, i) + "\\ ";
        i += 1;
        start = i;
        ch = "\\";
      }
      if (ch === "\\")
        switch (json[i + 1]) {
          case "u":
            {
              str += json.slice(start, i);
              const code = json.substr(i + 2, 4);
              switch (code) {
                case "0000":
                  str += "\\0";
                  break;
                case "0007":
                  str += "\\a";
                  break;
                case "000b":
                  str += "\\v";
                  break;
                case "001b":
                  str += "\\e";
                  break;
                case "0085":
                  str += "\\N";
                  break;
                case "00a0":
                  str += "\\_";
                  break;
                case "2028":
                  str += "\\L";
                  break;
                case "2029":
                  str += "\\P";
                  break;
                default:
                  if (code.substr(0, 2) === "00")
                    str += "\\x" + code.substr(2);
                  else
                    str += json.substr(i, 6);
              }
              i += 5;
              start = i + 1;
            }
            break;
          case "n":
            if (implicitKey || json[i + 2] === '"' || json.length < minMultiLineLength) {
              i += 1;
            } else {
              str += json.slice(start, i) + `

`;
              while (json[i + 2] === "\\" && json[i + 3] === "n" && json[i + 4] !== '"') {
                str += `
`;
                i += 2;
              }
              str += indent;
              if (json[i + 2] === " ")
                str += "\\";
              i += 1;
              start = i + 1;
            }
            break;
          default:
            i += 1;
        }
    }
    str = start ? str + json.slice(start) : json;
    return implicitKey ? str : foldFlowLines.foldFlowLines(str, indent, foldFlowLines.FOLD_QUOTED, getFoldOptions(ctx, false));
  }
  function singleQuotedString(value, ctx) {
    if (ctx.options.singleQuote === false || ctx.implicitKey && value.includes(`
`) || /[ \t]\n|\n[ \t]/.test(value))
      return doubleQuotedString(value, ctx);
    const indent = ctx.indent || (containsDocumentMarker(value) ? "  " : "");
    const res = "'" + value.replace(/'/g, "''").replace(/\n+/g, `$&
${indent}`) + "'";
    return ctx.implicitKey ? res : foldFlowLines.foldFlowLines(res, indent, foldFlowLines.FOLD_FLOW, getFoldOptions(ctx, false));
  }
  function quotedString(value, ctx) {
    const { singleQuote } = ctx.options;
    let qs;
    if (singleQuote === false)
      qs = doubleQuotedString;
    else {
      const hasDouble = value.includes('"');
      const hasSingle = value.includes("'");
      if (hasDouble && !hasSingle)
        qs = singleQuotedString;
      else if (hasSingle && !hasDouble)
        qs = doubleQuotedString;
      else
        qs = singleQuote ? singleQuotedString : doubleQuotedString;
    }
    return qs(value, ctx);
  }
  var blockEndNewlines;
  try {
    blockEndNewlines = new RegExp(`(^|(?<!
))
+(?!
|$)`, "g");
  } catch {
    blockEndNewlines = /\n+(?!\n|$)/g;
  }
  function blockString({ comment, type, value }, ctx, onComment, onChompKeep) {
    const { blockQuote, commentString, lineWidth } = ctx.options;
    if (!blockQuote || /\n[\t ]+$/.test(value)) {
      return quotedString(value, ctx);
    }
    const indent = ctx.indent || (ctx.forceBlockIndent || containsDocumentMarker(value) ? "  " : "");
    const literal = blockQuote === "literal" ? true : blockQuote === "folded" || type === Scalar.Scalar.BLOCK_FOLDED ? false : type === Scalar.Scalar.BLOCK_LITERAL ? true : !lineLengthOverLimit(value, lineWidth, indent.length);
    if (!value)
      return literal ? `|
` : `>
`;
    let chomp;
    let endStart;
    for (endStart = value.length;endStart > 0; --endStart) {
      const ch = value[endStart - 1];
      if (ch !== `
` && ch !== "\t" && ch !== " ")
        break;
    }
    let end = value.substring(endStart);
    const endNlPos = end.indexOf(`
`);
    if (endNlPos === -1) {
      chomp = "-";
    } else if (value === end || endNlPos !== end.length - 1) {
      chomp = "+";
      if (onChompKeep)
        onChompKeep();
    } else {
      chomp = "";
    }
    if (end) {
      value = value.slice(0, -end.length);
      if (end[end.length - 1] === `
`)
        end = end.slice(0, -1);
      end = end.replace(blockEndNewlines, `$&${indent}`);
    }
    let startWithSpace = false;
    let startEnd;
    let startNlPos = -1;
    for (startEnd = 0;startEnd < value.length; ++startEnd) {
      const ch = value[startEnd];
      if (ch === " ")
        startWithSpace = true;
      else if (ch === `
`)
        startNlPos = startEnd;
      else
        break;
    }
    let start = value.substring(0, startNlPos < startEnd ? startNlPos + 1 : startEnd);
    if (start) {
      value = value.substring(start.length);
      start = start.replace(/\n+/g, `$&${indent}`);
    }
    const indentSize = indent ? "2" : "1";
    let header = (startWithSpace ? indentSize : "") + chomp;
    if (comment) {
      header += " " + commentString(comment.replace(/ ?[\r\n]+/g, " "));
      if (onComment)
        onComment();
    }
    if (!literal) {
      const foldedValue = value.replace(/\n+/g, `
$&`).replace(/(?:^|\n)([\t ].*)(?:([\n\t ]*)\n(?![\n\t ]))?/g, "$1$2").replace(/\n+/g, `$&${indent}`);
      let literalFallback = false;
      const foldOptions = getFoldOptions(ctx, true);
      if (blockQuote !== "folded" && type !== Scalar.Scalar.BLOCK_FOLDED) {
        foldOptions.onOverflow = () => {
          literalFallback = true;
        };
      }
      const body = foldFlowLines.foldFlowLines(`${start}${foldedValue}${end}`, indent, foldFlowLines.FOLD_BLOCK, foldOptions);
      if (!literalFallback)
        return `>${header}
${indent}${body}`;
    }
    value = value.replace(/\n+/g, `$&${indent}`);
    return `|${header}
${indent}${start}${value}${end}`;
  }
  function plainString(item, ctx, onComment, onChompKeep) {
    const { type, value } = item;
    const { actualString, implicitKey, indent, indentStep, inFlow } = ctx;
    if (implicitKey && value.includes(`
`) || inFlow && /[[\]{},]/.test(value)) {
      return quotedString(value, ctx);
    }
    if (/^[\n\t ,[\]{}#&*!|>'"%@`]|^[?-]$|^[?-][ \t]|[\n:][ \t]|[ \t]\n|[\n\t ]#|[\n\t :]$/.test(value)) {
      return implicitKey || inFlow || !value.includes(`
`) ? quotedString(value, ctx) : blockString(item, ctx, onComment, onChompKeep);
    }
    if (!implicitKey && !inFlow && type !== Scalar.Scalar.PLAIN && value.includes(`
`)) {
      return blockString(item, ctx, onComment, onChompKeep);
    }
    if (containsDocumentMarker(value)) {
      if (indent === "") {
        ctx.forceBlockIndent = true;
        return blockString(item, ctx, onComment, onChompKeep);
      } else if (implicitKey && indent === indentStep) {
        return quotedString(value, ctx);
      }
    }
    const str = value.replace(/\n+/g, `$&
${indent}`);
    if (actualString) {
      const test = (tag) => tag.default && tag.tag !== "tag:yaml.org,2002:str" && tag.test?.test(str);
      const { compat, tags } = ctx.doc.schema;
      if (tags.some(test) || compat?.some(test))
        return quotedString(value, ctx);
    }
    return implicitKey ? str : foldFlowLines.foldFlowLines(str, indent, foldFlowLines.FOLD_FLOW, getFoldOptions(ctx, false));
  }
  function stringifyString(item, ctx, onComment, onChompKeep) {
    const { implicitKey, inFlow } = ctx;
    const ss = typeof item.value === "string" ? item : Object.assign({}, item, { value: String(item.value) });
    let { type } = item;
    if (type !== Scalar.Scalar.QUOTE_DOUBLE) {
      if (/[\x00-\x08\x0b-\x1f\x7f-\x9f\u{D800}-\u{DFFF}]/u.test(ss.value))
        type = Scalar.Scalar.QUOTE_DOUBLE;
    }
    const _stringify = (_type) => {
      switch (_type) {
        case Scalar.Scalar.BLOCK_FOLDED:
        case Scalar.Scalar.BLOCK_LITERAL:
          return implicitKey || inFlow ? quotedString(ss.value, ctx) : blockString(ss, ctx, onComment, onChompKeep);
        case Scalar.Scalar.QUOTE_DOUBLE:
          return doubleQuotedString(ss.value, ctx);
        case Scalar.Scalar.QUOTE_SINGLE:
          return singleQuotedString(ss.value, ctx);
        case Scalar.Scalar.PLAIN:
          return plainString(ss, ctx, onComment, onChompKeep);
        default:
          return null;
      }
    };
    let res = _stringify(type);
    if (res === null) {
      const { defaultKeyType, defaultStringType } = ctx.options;
      const t = implicitKey && defaultKeyType || defaultStringType;
      res = _stringify(t);
      if (res === null)
        throw new Error(`Unsupported default string type ${t}`);
    }
    return res;
  }
  exports.stringifyString = stringifyString;
});

// node_modules/yaml/dist/stringify/stringify.js
var require_stringify = __commonJS((exports) => {
  var anchors = require_anchors();
  var identity = require_identity();
  var stringifyComment = require_stringifyComment();
  var stringifyString = require_stringifyString();
  function createStringifyContext(doc, options) {
    const opt = Object.assign({
      blockQuote: true,
      commentString: stringifyComment.stringifyComment,
      defaultKeyType: null,
      defaultStringType: "PLAIN",
      directives: null,
      doubleQuotedAsJSON: false,
      doubleQuotedMinMultiLineLength: 40,
      falseStr: "false",
      flowCollectionPadding: true,
      indentSeq: true,
      lineWidth: 80,
      minContentWidth: 20,
      nullStr: "null",
      simpleKeys: false,
      singleQuote: null,
      trailingComma: false,
      trueStr: "true",
      verifyAliasOrder: true
    }, doc.schema.toStringOptions, options);
    let inFlow;
    switch (opt.collectionStyle) {
      case "block":
        inFlow = false;
        break;
      case "flow":
        inFlow = true;
        break;
      default:
        inFlow = null;
    }
    return {
      anchors: new Set,
      doc,
      flowCollectionPadding: opt.flowCollectionPadding ? " " : "",
      indent: "",
      indentStep: typeof opt.indent === "number" ? " ".repeat(opt.indent) : "  ",
      inFlow,
      options: opt
    };
  }
  function getTagObject(tags, item) {
    if (item.tag) {
      const match = tags.filter((t) => t.tag === item.tag);
      if (match.length > 0)
        return match.find((t) => t.format === item.format) ?? match[0];
    }
    let tagObj = undefined;
    let obj;
    if (identity.isScalar(item)) {
      obj = item.value;
      let match = tags.filter((t) => t.identify?.(obj));
      if (match.length > 1) {
        const testMatch = match.filter((t) => t.test);
        if (testMatch.length > 0)
          match = testMatch;
      }
      tagObj = match.find((t) => t.format === item.format) ?? match.find((t) => !t.format);
    } else {
      obj = item;
      tagObj = tags.find((t) => t.nodeClass && obj instanceof t.nodeClass);
    }
    if (!tagObj) {
      const name = obj?.constructor?.name ?? (obj === null ? "null" : typeof obj);
      throw new Error(`Tag not resolved for ${name} value`);
    }
    return tagObj;
  }
  function stringifyProps(node, tagObj, { anchors: anchors$1, doc }) {
    if (!doc.directives)
      return "";
    const props = [];
    const anchor = (identity.isScalar(node) || identity.isCollection(node)) && node.anchor;
    if (anchor && anchors.anchorIsValid(anchor)) {
      anchors$1.add(anchor);
      props.push(`&${anchor}`);
    }
    const tag = node.tag ?? (tagObj.default ? null : tagObj.tag);
    if (tag)
      props.push(doc.directives.tagString(tag));
    return props.join(" ");
  }
  function stringify(item, ctx, onComment, onChompKeep) {
    if (identity.isPair(item))
      return item.toString(ctx, onComment, onChompKeep);
    if (identity.isAlias(item)) {
      if (ctx.doc.directives)
        return item.toString(ctx);
      if (ctx.resolvedAliases?.has(item)) {
        throw new TypeError(`Cannot stringify circular structure without alias nodes`);
      } else {
        if (ctx.resolvedAliases)
          ctx.resolvedAliases.add(item);
        else
          ctx.resolvedAliases = new Set([item]);
        item = item.resolve(ctx.doc);
      }
    }
    let tagObj = undefined;
    const node = identity.isNode(item) ? item : ctx.doc.createNode(item, { onTagObj: (o) => tagObj = o });
    tagObj ?? (tagObj = getTagObject(ctx.doc.schema.tags, node));
    const props = stringifyProps(node, tagObj, ctx);
    if (props.length > 0)
      ctx.indentAtStart = (ctx.indentAtStart ?? 0) + props.length + 1;
    const str = typeof tagObj.stringify === "function" ? tagObj.stringify(node, ctx, onComment, onChompKeep) : identity.isScalar(node) ? stringifyString.stringifyString(node, ctx, onComment, onChompKeep) : node.toString(ctx, onComment, onChompKeep);
    if (!props)
      return str;
    return identity.isScalar(node) || str[0] === "{" || str[0] === "[" ? `${props} ${str}` : `${props}
${ctx.indent}${str}`;
  }
  exports.createStringifyContext = createStringifyContext;
  exports.stringify = stringify;
});

// node_modules/yaml/dist/stringify/stringifyPair.js
var require_stringifyPair = __commonJS((exports) => {
  var identity = require_identity();
  var Scalar = require_Scalar();
  var stringify = require_stringify();
  var stringifyComment = require_stringifyComment();
  function stringifyPair({ key, value }, ctx, onComment, onChompKeep) {
    const { allNullValues, doc, indent, indentStep, options: { commentString, indentSeq, simpleKeys } } = ctx;
    let keyComment = identity.isNode(key) && key.comment || null;
    if (simpleKeys) {
      if (keyComment) {
        throw new Error("With simple keys, key nodes cannot have comments");
      }
      if (identity.isCollection(key) || !identity.isNode(key) && typeof key === "object") {
        const msg = "With simple keys, collection cannot be used as a key value";
        throw new Error(msg);
      }
    }
    let explicitKey = !simpleKeys && (!key || keyComment && value == null && !ctx.inFlow || identity.isCollection(key) || (identity.isScalar(key) ? key.type === Scalar.Scalar.BLOCK_FOLDED || key.type === Scalar.Scalar.BLOCK_LITERAL : typeof key === "object"));
    ctx = Object.assign({}, ctx, {
      allNullValues: false,
      implicitKey: !explicitKey && (simpleKeys || !allNullValues),
      indent: indent + indentStep
    });
    let keyCommentDone = false;
    let chompKeep = false;
    let str = stringify.stringify(key, ctx, () => keyCommentDone = true, () => chompKeep = true);
    if (!explicitKey && !ctx.inFlow && str.length > 1024) {
      if (simpleKeys)
        throw new Error("With simple keys, single line scalar must not span more than 1024 characters");
      explicitKey = true;
    }
    if (ctx.inFlow) {
      if (allNullValues || value == null) {
        if (keyCommentDone && onComment)
          onComment();
        return str === "" ? "?" : explicitKey ? `? ${str}` : str;
      }
    } else if (allNullValues && !simpleKeys || value == null && explicitKey) {
      str = `? ${str}`;
      if (keyComment && !keyCommentDone) {
        str += stringifyComment.lineComment(str, ctx.indent, commentString(keyComment));
      } else if (chompKeep && onChompKeep)
        onChompKeep();
      return str;
    }
    if (keyCommentDone)
      keyComment = null;
    if (explicitKey) {
      if (keyComment)
        str += stringifyComment.lineComment(str, ctx.indent, commentString(keyComment));
      str = `? ${str}
${indent}:`;
    } else {
      str = `${str}:`;
      if (keyComment)
        str += stringifyComment.lineComment(str, ctx.indent, commentString(keyComment));
    }
    let vsb, vcb, valueComment;
    if (identity.isNode(value)) {
      vsb = !!value.spaceBefore;
      vcb = value.commentBefore;
      valueComment = value.comment;
    } else {
      vsb = false;
      vcb = null;
      valueComment = null;
      if (value && typeof value === "object")
        value = doc.createNode(value);
    }
    ctx.implicitKey = false;
    if (!explicitKey && !keyComment && identity.isScalar(value))
      ctx.indentAtStart = str.length + 1;
    chompKeep = false;
    if (!indentSeq && indentStep.length >= 2 && !ctx.inFlow && !explicitKey && identity.isSeq(value) && !value.flow && !value.tag && !value.anchor) {
      ctx.indent = ctx.indent.substring(2);
    }
    let valueCommentDone = false;
    const valueStr = stringify.stringify(value, ctx, () => valueCommentDone = true, () => chompKeep = true);
    let ws = " ";
    if (keyComment || vsb || vcb) {
      ws = vsb ? `
` : "";
      if (vcb) {
        const cs = commentString(vcb);
        ws += `
${stringifyComment.indentComment(cs, ctx.indent)}`;
      }
      if (valueStr === "" && !ctx.inFlow) {
        if (ws === `
` && valueComment)
          ws = `

`;
      } else {
        ws += `
${ctx.indent}`;
      }
    } else if (!explicitKey && identity.isCollection(value)) {
      const vs0 = valueStr[0];
      const nl0 = valueStr.indexOf(`
`);
      const hasNewline = nl0 !== -1;
      const flow = ctx.inFlow ?? value.flow ?? value.items.length === 0;
      if (hasNewline || !flow) {
        let hasPropsLine = false;
        if (hasNewline && (vs0 === "&" || vs0 === "!")) {
          let sp0 = valueStr.indexOf(" ");
          if (vs0 === "&" && sp0 !== -1 && sp0 < nl0 && valueStr[sp0 + 1] === "!") {
            sp0 = valueStr.indexOf(" ", sp0 + 1);
          }
          if (sp0 === -1 || nl0 < sp0)
            hasPropsLine = true;
        }
        if (!hasPropsLine)
          ws = `
${ctx.indent}`;
      }
    } else if (valueStr === "" || valueStr[0] === `
`) {
      ws = "";
    }
    str += ws + valueStr;
    if (ctx.inFlow) {
      if (valueCommentDone && onComment)
        onComment();
    } else if (valueComment && !valueCommentDone) {
      str += stringifyComment.lineComment(str, ctx.indent, commentString(valueComment));
    } else if (chompKeep && onChompKeep) {
      onChompKeep();
    }
    return str;
  }
  exports.stringifyPair = stringifyPair;
});

// node_modules/yaml/dist/log.js
var require_log = __commonJS((exports) => {
  var node_process = __require("process");
  function debug(logLevel, ...messages) {
    if (logLevel === "debug")
      console.log(...messages);
  }
  function warn(logLevel, warning) {
    if (logLevel === "debug" || logLevel === "warn") {
      if (typeof node_process.emitWarning === "function")
        node_process.emitWarning(warning);
      else
        console.warn(warning);
    }
  }
  exports.debug = debug;
  exports.warn = warn;
});

// node_modules/yaml/dist/schema/yaml-1.1/merge.js
var require_merge = __commonJS((exports) => {
  var identity = require_identity();
  var Scalar = require_Scalar();
  var MERGE_KEY = "<<";
  var merge = {
    identify: (value) => value === MERGE_KEY || typeof value === "symbol" && value.description === MERGE_KEY,
    default: "key",
    tag: "tag:yaml.org,2002:merge",
    test: /^<<$/,
    resolve: () => Object.assign(new Scalar.Scalar(Symbol(MERGE_KEY)), {
      addToJSMap: addMergeToJSMap
    }),
    stringify: () => MERGE_KEY
  };
  var isMergeKey = (ctx, key) => (merge.identify(key) || identity.isScalar(key) && (!key.type || key.type === Scalar.Scalar.PLAIN) && merge.identify(key.value)) && ctx?.doc.schema.tags.some((tag) => tag.tag === merge.tag && tag.default);
  function addMergeToJSMap(ctx, map, value) {
    const source = resolveAliasValue(ctx, value);
    if (identity.isSeq(source))
      for (const it of source.items)
        mergeValue(ctx, map, it);
    else if (Array.isArray(source))
      for (const it of source)
        mergeValue(ctx, map, it);
    else
      mergeValue(ctx, map, source);
  }
  function mergeValue(ctx, map, value) {
    const source = resolveAliasValue(ctx, value);
    if (!identity.isMap(source))
      throw new Error("Merge sources must be maps or map aliases");
    const srcMap = source.toJSON(null, ctx, Map);
    for (const [key, value2] of srcMap) {
      if (map instanceof Map) {
        if (!map.has(key))
          map.set(key, value2);
      } else if (map instanceof Set) {
        map.add(key);
      } else if (!Object.prototype.hasOwnProperty.call(map, key)) {
        Object.defineProperty(map, key, {
          value: value2,
          writable: true,
          enumerable: true,
          configurable: true
        });
      }
    }
    return map;
  }
  function resolveAliasValue(ctx, value) {
    return ctx && identity.isAlias(value) ? value.resolve(ctx.doc, ctx) : value;
  }
  exports.addMergeToJSMap = addMergeToJSMap;
  exports.isMergeKey = isMergeKey;
  exports.merge = merge;
});

// node_modules/yaml/dist/nodes/addPairToJSMap.js
var require_addPairToJSMap = __commonJS((exports) => {
  var log2 = require_log();
  var merge = require_merge();
  var stringify = require_stringify();
  var identity = require_identity();
  var toJS = require_toJS();
  function addPairToJSMap(ctx, map, { key, value }) {
    if (identity.isNode(key) && key.addToJSMap)
      key.addToJSMap(ctx, map, value);
    else if (merge.isMergeKey(ctx, key))
      merge.addMergeToJSMap(ctx, map, value);
    else {
      const jsKey = toJS.toJS(key, "", ctx);
      if (map instanceof Map) {
        map.set(jsKey, toJS.toJS(value, jsKey, ctx));
      } else if (map instanceof Set) {
        map.add(jsKey);
      } else {
        const stringKey = stringifyKey(key, jsKey, ctx);
        const jsValue = toJS.toJS(value, stringKey, ctx);
        if (stringKey in map)
          Object.defineProperty(map, stringKey, {
            value: jsValue,
            writable: true,
            enumerable: true,
            configurable: true
          });
        else
          map[stringKey] = jsValue;
      }
    }
    return map;
  }
  function stringifyKey(key, jsKey, ctx) {
    if (jsKey === null)
      return "";
    if (typeof jsKey !== "object")
      return String(jsKey);
    if (identity.isNode(key) && ctx?.doc) {
      const strCtx = stringify.createStringifyContext(ctx.doc, {});
      strCtx.anchors = new Set;
      for (const node of ctx.anchors.keys())
        strCtx.anchors.add(node.anchor);
      strCtx.inFlow = true;
      strCtx.inStringifyKey = true;
      const strKey = key.toString(strCtx);
      if (!ctx.mapKeyWarned) {
        let jsonStr = JSON.stringify(strKey);
        if (jsonStr.length > 40)
          jsonStr = jsonStr.substring(0, 36) + '..."';
        log2.warn(ctx.doc.options.logLevel, `Keys with collection values will be stringified due to JS Object restrictions: ${jsonStr}. Set mapAsMap: true to use object keys.`);
        ctx.mapKeyWarned = true;
      }
      return strKey;
    }
    return JSON.stringify(jsKey);
  }
  exports.addPairToJSMap = addPairToJSMap;
});

// node_modules/yaml/dist/nodes/Pair.js
var require_Pair = __commonJS((exports) => {
  var createNode = require_createNode();
  var stringifyPair = require_stringifyPair();
  var addPairToJSMap = require_addPairToJSMap();
  var identity = require_identity();
  function createPair(key, value, ctx) {
    const k = createNode.createNode(key, undefined, ctx);
    const v = createNode.createNode(value, undefined, ctx);
    return new Pair(k, v);
  }

  class Pair {
    constructor(key, value = null) {
      Object.defineProperty(this, identity.NODE_TYPE, { value: identity.PAIR });
      this.key = key;
      this.value = value;
    }
    clone(schema) {
      let { key, value } = this;
      if (identity.isNode(key))
        key = key.clone(schema);
      if (identity.isNode(value))
        value = value.clone(schema);
      return new Pair(key, value);
    }
    toJSON(_, ctx) {
      const pair = ctx?.mapAsMap ? new Map : {};
      return addPairToJSMap.addPairToJSMap(ctx, pair, this);
    }
    toString(ctx, onComment, onChompKeep) {
      return ctx?.doc ? stringifyPair.stringifyPair(this, ctx, onComment, onChompKeep) : JSON.stringify(this);
    }
  }
  exports.Pair = Pair;
  exports.createPair = createPair;
});

// node_modules/yaml/dist/stringify/stringifyCollection.js
var require_stringifyCollection = __commonJS((exports) => {
  var identity = require_identity();
  var stringify = require_stringify();
  var stringifyComment = require_stringifyComment();
  function stringifyCollection(collection, ctx, options) {
    const flow = ctx.inFlow ?? collection.flow;
    const stringify2 = flow ? stringifyFlowCollection : stringifyBlockCollection;
    return stringify2(collection, ctx, options);
  }
  function stringifyBlockCollection({ comment, items }, ctx, { blockItemPrefix, flowChars, itemIndent, onChompKeep, onComment }) {
    const { indent, options: { commentString } } = ctx;
    const itemCtx = Object.assign({}, ctx, { indent: itemIndent, type: null });
    let chompKeep = false;
    const lines = [];
    for (let i = 0;i < items.length; ++i) {
      const item = items[i];
      let comment2 = null;
      if (identity.isNode(item)) {
        if (!chompKeep && item.spaceBefore)
          lines.push("");
        addCommentBefore(ctx, lines, item.commentBefore, chompKeep);
        if (item.comment)
          comment2 = item.comment;
      } else if (identity.isPair(item)) {
        const ik = identity.isNode(item.key) ? item.key : null;
        if (ik) {
          if (!chompKeep && ik.spaceBefore)
            lines.push("");
          addCommentBefore(ctx, lines, ik.commentBefore, chompKeep);
        }
      }
      chompKeep = false;
      let str2 = stringify.stringify(item, itemCtx, () => comment2 = null, () => chompKeep = true);
      if (comment2)
        str2 += stringifyComment.lineComment(str2, itemIndent, commentString(comment2));
      if (chompKeep && comment2)
        chompKeep = false;
      lines.push(blockItemPrefix + str2);
    }
    let str;
    if (lines.length === 0) {
      str = flowChars.start + flowChars.end;
    } else {
      str = lines[0];
      for (let i = 1;i < lines.length; ++i) {
        const line = lines[i];
        str += line ? `
${indent}${line}` : `
`;
      }
    }
    if (comment) {
      str += `
` + stringifyComment.indentComment(commentString(comment), indent);
      if (onComment)
        onComment();
    } else if (chompKeep && onChompKeep)
      onChompKeep();
    return str;
  }
  function stringifyFlowCollection({ items }, ctx, { flowChars, itemIndent }) {
    const { indent, indentStep, flowCollectionPadding: fcPadding, options: { commentString } } = ctx;
    itemIndent += indentStep;
    const itemCtx = Object.assign({}, ctx, {
      indent: itemIndent,
      inFlow: true,
      type: null
    });
    let reqNewline = false;
    let linesAtValue = 0;
    const lines = [];
    for (let i = 0;i < items.length; ++i) {
      const item = items[i];
      let comment = null;
      if (identity.isNode(item)) {
        if (item.spaceBefore)
          lines.push("");
        addCommentBefore(ctx, lines, item.commentBefore, false);
        if (item.comment)
          comment = item.comment;
      } else if (identity.isPair(item)) {
        const ik = identity.isNode(item.key) ? item.key : null;
        if (ik) {
          if (ik.spaceBefore)
            lines.push("");
          addCommentBefore(ctx, lines, ik.commentBefore, false);
          if (ik.comment)
            reqNewline = true;
        }
        const iv = identity.isNode(item.value) ? item.value : null;
        if (iv) {
          if (iv.comment)
            comment = iv.comment;
          if (iv.commentBefore)
            reqNewline = true;
        } else if (item.value == null && ik?.comment) {
          comment = ik.comment;
        }
      }
      if (comment)
        reqNewline = true;
      let str = stringify.stringify(item, itemCtx, () => comment = null);
      reqNewline || (reqNewline = lines.length > linesAtValue || str.includes(`
`));
      if (i < items.length - 1) {
        str += ",";
      } else if (ctx.options.trailingComma) {
        if (ctx.options.lineWidth > 0) {
          reqNewline || (reqNewline = lines.reduce((sum, line) => sum + line.length + 2, 2) + (str.length + 2) > ctx.options.lineWidth);
        }
        if (reqNewline) {
          str += ",";
        }
      }
      if (comment)
        str += stringifyComment.lineComment(str, itemIndent, commentString(comment));
      lines.push(str);
      linesAtValue = lines.length;
    }
    const { start, end } = flowChars;
    if (lines.length === 0) {
      return start + end;
    } else {
      if (!reqNewline) {
        const len = lines.reduce((sum, line) => sum + line.length + 2, 2);
        reqNewline = ctx.options.lineWidth > 0 && len > ctx.options.lineWidth;
      }
      if (reqNewline) {
        let str = start;
        for (const line of lines)
          str += line ? `
${indentStep}${indent}${line}` : `
`;
        return `${str}
${indent}${end}`;
      } else {
        return `${start}${fcPadding}${lines.join(" ")}${fcPadding}${end}`;
      }
    }
  }
  function addCommentBefore({ indent, options: { commentString } }, lines, comment, chompKeep) {
    if (comment && chompKeep)
      comment = comment.replace(/^\n+/, "");
    if (comment) {
      const ic = stringifyComment.indentComment(commentString(comment), indent);
      lines.push(ic.trimStart());
    }
  }
  exports.stringifyCollection = stringifyCollection;
});

// node_modules/yaml/dist/nodes/YAMLMap.js
var require_YAMLMap = __commonJS((exports) => {
  var stringifyCollection = require_stringifyCollection();
  var addPairToJSMap = require_addPairToJSMap();
  var Collection = require_Collection();
  var identity = require_identity();
  var Pair = require_Pair();
  var Scalar = require_Scalar();
  function findPair(items, key) {
    const k = identity.isScalar(key) ? key.value : key;
    for (const it of items) {
      if (identity.isPair(it)) {
        if (it.key === key || it.key === k)
          return it;
        if (identity.isScalar(it.key) && it.key.value === k)
          return it;
      }
    }
    return;
  }

  class YAMLMap extends Collection.Collection {
    static get tagName() {
      return "tag:yaml.org,2002:map";
    }
    constructor(schema) {
      super(identity.MAP, schema);
      this.items = [];
    }
    static from(schema, obj, ctx) {
      const { keepUndefined, replacer } = ctx;
      const map = new this(schema);
      const add = (key, value) => {
        if (typeof replacer === "function")
          value = replacer.call(obj, key, value);
        else if (Array.isArray(replacer) && !replacer.includes(key))
          return;
        if (value !== undefined || keepUndefined)
          map.items.push(Pair.createPair(key, value, ctx));
      };
      if (obj instanceof Map) {
        for (const [key, value] of obj)
          add(key, value);
      } else if (obj && typeof obj === "object") {
        for (const key of Object.keys(obj))
          add(key, obj[key]);
      }
      if (typeof schema.sortMapEntries === "function") {
        map.items.sort(schema.sortMapEntries);
      }
      return map;
    }
    add(pair, overwrite) {
      let _pair;
      if (identity.isPair(pair))
        _pair = pair;
      else if (!pair || typeof pair !== "object" || !("key" in pair)) {
        _pair = new Pair.Pair(pair, pair?.value);
      } else
        _pair = new Pair.Pair(pair.key, pair.value);
      const prev = findPair(this.items, _pair.key);
      const sortEntries = this.schema?.sortMapEntries;
      if (prev) {
        if (!overwrite)
          throw new Error(`Key ${_pair.key} already set`);
        if (identity.isScalar(prev.value) && Scalar.isScalarValue(_pair.value))
          prev.value.value = _pair.value;
        else
          prev.value = _pair.value;
      } else if (sortEntries) {
        const i = this.items.findIndex((item) => sortEntries(_pair, item) < 0);
        if (i === -1)
          this.items.push(_pair);
        else
          this.items.splice(i, 0, _pair);
      } else {
        this.items.push(_pair);
      }
    }
    delete(key) {
      const it = findPair(this.items, key);
      if (!it)
        return false;
      const del = this.items.splice(this.items.indexOf(it), 1);
      return del.length > 0;
    }
    get(key, keepScalar) {
      const it = findPair(this.items, key);
      const node = it?.value;
      return (!keepScalar && identity.isScalar(node) ? node.value : node) ?? undefined;
    }
    has(key) {
      return !!findPair(this.items, key);
    }
    set(key, value) {
      this.add(new Pair.Pair(key, value), true);
    }
    toJSON(_, ctx, Type) {
      const map = Type ? new Type : ctx?.mapAsMap ? new Map : {};
      if (ctx?.onCreate)
        ctx.onCreate(map);
      for (const item of this.items)
        addPairToJSMap.addPairToJSMap(ctx, map, item);
      return map;
    }
    toString(ctx, onComment, onChompKeep) {
      if (!ctx)
        return JSON.stringify(this);
      for (const item of this.items) {
        if (!identity.isPair(item))
          throw new Error(`Map items must all be pairs; found ${JSON.stringify(item)} instead`);
      }
      if (!ctx.allNullValues && this.hasAllNullValues(false))
        ctx = Object.assign({}, ctx, { allNullValues: true });
      return stringifyCollection.stringifyCollection(this, ctx, {
        blockItemPrefix: "",
        flowChars: { start: "{", end: "}" },
        itemIndent: ctx.indent || "",
        onChompKeep,
        onComment
      });
    }
  }
  exports.YAMLMap = YAMLMap;
  exports.findPair = findPair;
});

// node_modules/yaml/dist/schema/common/map.js
var require_map = __commonJS((exports) => {
  var identity = require_identity();
  var YAMLMap = require_YAMLMap();
  var map = {
    collection: "map",
    default: true,
    nodeClass: YAMLMap.YAMLMap,
    tag: "tag:yaml.org,2002:map",
    resolve(map2, onError) {
      if (!identity.isMap(map2))
        onError("Expected a mapping for this tag");
      return map2;
    },
    createNode: (schema, obj, ctx) => YAMLMap.YAMLMap.from(schema, obj, ctx)
  };
  exports.map = map;
});

// node_modules/yaml/dist/nodes/YAMLSeq.js
var require_YAMLSeq = __commonJS((exports) => {
  var createNode = require_createNode();
  var stringifyCollection = require_stringifyCollection();
  var Collection = require_Collection();
  var identity = require_identity();
  var Scalar = require_Scalar();
  var toJS = require_toJS();

  class YAMLSeq extends Collection.Collection {
    static get tagName() {
      return "tag:yaml.org,2002:seq";
    }
    constructor(schema) {
      super(identity.SEQ, schema);
      this.items = [];
    }
    add(value) {
      this.items.push(value);
    }
    delete(key) {
      const idx = asItemIndex(key);
      if (typeof idx !== "number")
        return false;
      const del = this.items.splice(idx, 1);
      return del.length > 0;
    }
    get(key, keepScalar) {
      const idx = asItemIndex(key);
      if (typeof idx !== "number")
        return;
      const it = this.items[idx];
      return !keepScalar && identity.isScalar(it) ? it.value : it;
    }
    has(key) {
      const idx = asItemIndex(key);
      return typeof idx === "number" && idx < this.items.length;
    }
    set(key, value) {
      const idx = asItemIndex(key);
      if (typeof idx !== "number")
        throw new Error(`Expected a valid index, not ${key}.`);
      const prev = this.items[idx];
      if (identity.isScalar(prev) && Scalar.isScalarValue(value))
        prev.value = value;
      else
        this.items[idx] = value;
    }
    toJSON(_, ctx) {
      const seq = [];
      if (ctx?.onCreate)
        ctx.onCreate(seq);
      let i = 0;
      for (const item of this.items)
        seq.push(toJS.toJS(item, String(i++), ctx));
      return seq;
    }
    toString(ctx, onComment, onChompKeep) {
      if (!ctx)
        return JSON.stringify(this);
      return stringifyCollection.stringifyCollection(this, ctx, {
        blockItemPrefix: "- ",
        flowChars: { start: "[", end: "]" },
        itemIndent: (ctx.indent || "") + "  ",
        onChompKeep,
        onComment
      });
    }
    static from(schema, obj, ctx) {
      const { replacer } = ctx;
      const seq = new this(schema);
      if (obj && Symbol.iterator in Object(obj)) {
        let i = 0;
        for (let it of obj) {
          if (typeof replacer === "function") {
            const key = obj instanceof Set ? it : String(i++);
            it = replacer.call(obj, key, it);
          }
          seq.items.push(createNode.createNode(it, undefined, ctx));
        }
      }
      return seq;
    }
  }
  function asItemIndex(key) {
    let idx = identity.isScalar(key) ? key.value : key;
    if (idx && typeof idx === "string")
      idx = Number(idx);
    return typeof idx === "number" && Number.isInteger(idx) && idx >= 0 ? idx : null;
  }
  exports.YAMLSeq = YAMLSeq;
});

// node_modules/yaml/dist/schema/common/seq.js
var require_seq = __commonJS((exports) => {
  var identity = require_identity();
  var YAMLSeq = require_YAMLSeq();
  var seq = {
    collection: "seq",
    default: true,
    nodeClass: YAMLSeq.YAMLSeq,
    tag: "tag:yaml.org,2002:seq",
    resolve(seq2, onError) {
      if (!identity.isSeq(seq2))
        onError("Expected a sequence for this tag");
      return seq2;
    },
    createNode: (schema, obj, ctx) => YAMLSeq.YAMLSeq.from(schema, obj, ctx)
  };
  exports.seq = seq;
});

// node_modules/yaml/dist/schema/common/string.js
var require_string = __commonJS((exports) => {
  var stringifyString = require_stringifyString();
  var string = {
    identify: (value) => typeof value === "string",
    default: true,
    tag: "tag:yaml.org,2002:str",
    resolve: (str) => str,
    stringify(item, ctx, onComment, onChompKeep) {
      ctx = Object.assign({ actualString: true }, ctx);
      return stringifyString.stringifyString(item, ctx, onComment, onChompKeep);
    }
  };
  exports.string = string;
});

// node_modules/yaml/dist/schema/common/null.js
var require_null = __commonJS((exports) => {
  var Scalar = require_Scalar();
  var nullTag = {
    identify: (value) => value == null,
    createNode: () => new Scalar.Scalar(null),
    default: true,
    tag: "tag:yaml.org,2002:null",
    test: /^(?:~|[Nn]ull|NULL)?$/,
    resolve: () => new Scalar.Scalar(null),
    stringify: ({ source }, ctx) => typeof source === "string" && nullTag.test.test(source) ? source : ctx.options.nullStr
  };
  exports.nullTag = nullTag;
});

// node_modules/yaml/dist/schema/core/bool.js
var require_bool = __commonJS((exports) => {
  var Scalar = require_Scalar();
  var boolTag = {
    identify: (value) => typeof value === "boolean",
    default: true,
    tag: "tag:yaml.org,2002:bool",
    test: /^(?:[Tt]rue|TRUE|[Ff]alse|FALSE)$/,
    resolve: (str) => new Scalar.Scalar(str[0] === "t" || str[0] === "T"),
    stringify({ source, value }, ctx) {
      if (source && boolTag.test.test(source)) {
        const sv = source[0] === "t" || source[0] === "T";
        if (value === sv)
          return source;
      }
      return value ? ctx.options.trueStr : ctx.options.falseStr;
    }
  };
  exports.boolTag = boolTag;
});

// node_modules/yaml/dist/stringify/stringifyNumber.js
var require_stringifyNumber = __commonJS((exports) => {
  function stringifyNumber({ format, minFractionDigits, tag, value }) {
    if (typeof value === "bigint")
      return String(value);
    const num = typeof value === "number" ? value : Number(value);
    if (!isFinite(num))
      return isNaN(num) ? ".nan" : num < 0 ? "-.inf" : ".inf";
    let n = Object.is(value, -0) ? "-0" : JSON.stringify(value);
    if (!format && minFractionDigits && (!tag || tag === "tag:yaml.org,2002:float") && /^-?\d/.test(n) && !n.includes("e")) {
      let i = n.indexOf(".");
      if (i < 0) {
        i = n.length;
        n += ".";
      }
      let d = minFractionDigits - (n.length - i - 1);
      while (d-- > 0)
        n += "0";
    }
    return n;
  }
  exports.stringifyNumber = stringifyNumber;
});

// node_modules/yaml/dist/schema/core/float.js
var require_float = __commonJS((exports) => {
  var Scalar = require_Scalar();
  var stringifyNumber = require_stringifyNumber();
  var floatNaN = {
    identify: (value) => typeof value === "number",
    default: true,
    tag: "tag:yaml.org,2002:float",
    test: /^(?:[-+]?\.(?:inf|Inf|INF)|\.nan|\.NaN|\.NAN)$/,
    resolve: (str) => str.slice(-3).toLowerCase() === "nan" ? NaN : str[0] === "-" ? Number.NEGATIVE_INFINITY : Number.POSITIVE_INFINITY,
    stringify: stringifyNumber.stringifyNumber
  };
  var floatExp = {
    identify: (value) => typeof value === "number",
    default: true,
    tag: "tag:yaml.org,2002:float",
    format: "EXP",
    test: /^[-+]?(?:\.[0-9]+|[0-9]+(?:\.[0-9]*)?)[eE][-+]?[0-9]+$/,
    resolve: (str) => parseFloat(str),
    stringify(node) {
      const num = Number(node.value);
      return isFinite(num) ? num.toExponential() : stringifyNumber.stringifyNumber(node);
    }
  };
  var float = {
    identify: (value) => typeof value === "number",
    default: true,
    tag: "tag:yaml.org,2002:float",
    test: /^[-+]?(?:\.[0-9]+|[0-9]+\.[0-9]*)$/,
    resolve(str) {
      const node = new Scalar.Scalar(parseFloat(str));
      const dot = str.indexOf(".");
      if (dot !== -1 && str[str.length - 1] === "0")
        node.minFractionDigits = str.length - dot - 1;
      return node;
    },
    stringify: stringifyNumber.stringifyNumber
  };
  exports.float = float;
  exports.floatExp = floatExp;
  exports.floatNaN = floatNaN;
});

// node_modules/yaml/dist/schema/core/int.js
var require_int = __commonJS((exports) => {
  var stringifyNumber = require_stringifyNumber();
  var intIdentify = (value) => typeof value === "bigint" || Number.isInteger(value);
  var intResolve = (str, offset, radix, { intAsBigInt }) => intAsBigInt ? BigInt(str) : parseInt(str.substring(offset), radix);
  function intStringify(node, radix, prefix) {
    const { value } = node;
    if (intIdentify(value) && value >= 0)
      return prefix + value.toString(radix);
    return stringifyNumber.stringifyNumber(node);
  }
  var intOct = {
    identify: (value) => intIdentify(value) && value >= 0,
    default: true,
    tag: "tag:yaml.org,2002:int",
    format: "OCT",
    test: /^0o[0-7]+$/,
    resolve: (str, _onError, opt) => intResolve(str, 2, 8, opt),
    stringify: (node) => intStringify(node, 8, "0o")
  };
  var int = {
    identify: intIdentify,
    default: true,
    tag: "tag:yaml.org,2002:int",
    test: /^[-+]?[0-9]+$/,
    resolve: (str, _onError, opt) => intResolve(str, 0, 10, opt),
    stringify: stringifyNumber.stringifyNumber
  };
  var intHex = {
    identify: (value) => intIdentify(value) && value >= 0,
    default: true,
    tag: "tag:yaml.org,2002:int",
    format: "HEX",
    test: /^0x[0-9a-fA-F]+$/,
    resolve: (str, _onError, opt) => intResolve(str, 2, 16, opt),
    stringify: (node) => intStringify(node, 16, "0x")
  };
  exports.int = int;
  exports.intHex = intHex;
  exports.intOct = intOct;
});

// node_modules/yaml/dist/schema/core/schema.js
var require_schema = __commonJS((exports) => {
  var map = require_map();
  var _null = require_null();
  var seq = require_seq();
  var string = require_string();
  var bool = require_bool();
  var float = require_float();
  var int = require_int();
  var schema = [
    map.map,
    seq.seq,
    string.string,
    _null.nullTag,
    bool.boolTag,
    int.intOct,
    int.int,
    int.intHex,
    float.floatNaN,
    float.floatExp,
    float.float
  ];
  exports.schema = schema;
});

// node_modules/yaml/dist/schema/json/schema.js
var require_schema2 = __commonJS((exports) => {
  var Scalar = require_Scalar();
  var map = require_map();
  var seq = require_seq();
  function intIdentify(value) {
    return typeof value === "bigint" || Number.isInteger(value);
  }
  var stringifyJSON = ({ value }) => JSON.stringify(value);
  var jsonScalars = [
    {
      identify: (value) => typeof value === "string",
      default: true,
      tag: "tag:yaml.org,2002:str",
      resolve: (str) => str,
      stringify: stringifyJSON
    },
    {
      identify: (value) => value == null,
      createNode: () => new Scalar.Scalar(null),
      default: true,
      tag: "tag:yaml.org,2002:null",
      test: /^null$/,
      resolve: () => null,
      stringify: stringifyJSON
    },
    {
      identify: (value) => typeof value === "boolean",
      default: true,
      tag: "tag:yaml.org,2002:bool",
      test: /^true$|^false$/,
      resolve: (str) => str === "true",
      stringify: stringifyJSON
    },
    {
      identify: intIdentify,
      default: true,
      tag: "tag:yaml.org,2002:int",
      test: /^-?(?:0|[1-9][0-9]*)$/,
      resolve: (str, _onError, { intAsBigInt }) => intAsBigInt ? BigInt(str) : parseInt(str, 10),
      stringify: ({ value }) => intIdentify(value) ? value.toString() : JSON.stringify(value)
    },
    {
      identify: (value) => typeof value === "number",
      default: true,
      tag: "tag:yaml.org,2002:float",
      test: /^-?(?:0|[1-9][0-9]*)(?:\.[0-9]*)?(?:[eE][-+]?[0-9]+)?$/,
      resolve: (str) => parseFloat(str),
      stringify: stringifyJSON
    }
  ];
  var jsonError = {
    default: true,
    tag: "",
    test: /^/,
    resolve(str, onError) {
      onError(`Unresolved plain scalar ${JSON.stringify(str)}`);
      return str;
    }
  };
  var schema = [map.map, seq.seq].concat(jsonScalars, jsonError);
  exports.schema = schema;
});

// node_modules/yaml/dist/schema/yaml-1.1/binary.js
var require_binary = __commonJS((exports) => {
  var node_buffer = __require("buffer");
  var Scalar = require_Scalar();
  var stringifyString = require_stringifyString();
  var binary = {
    identify: (value) => value instanceof Uint8Array,
    default: false,
    tag: "tag:yaml.org,2002:binary",
    resolve(src, onError) {
      if (typeof node_buffer.Buffer === "function") {
        return node_buffer.Buffer.from(src, "base64");
      } else if (typeof atob === "function") {
        const str = atob(src.replace(/[\n\r]/g, ""));
        const buffer = new Uint8Array(str.length);
        for (let i = 0;i < str.length; ++i)
          buffer[i] = str.charCodeAt(i);
        return buffer;
      } else {
        onError("This environment does not support reading binary tags; either Buffer or atob is required");
        return src;
      }
    },
    stringify({ comment, type, value }, ctx, onComment, onChompKeep) {
      if (!value)
        return "";
      const buf = value;
      let str;
      if (typeof node_buffer.Buffer === "function") {
        str = buf instanceof node_buffer.Buffer ? buf.toString("base64") : node_buffer.Buffer.from(buf.buffer).toString("base64");
      } else if (typeof btoa === "function") {
        let s = "";
        for (let i = 0;i < buf.length; ++i)
          s += String.fromCharCode(buf[i]);
        str = btoa(s);
      } else {
        throw new Error("This environment does not support writing binary tags; either Buffer or btoa is required");
      }
      type ?? (type = Scalar.Scalar.BLOCK_LITERAL);
      if (type !== Scalar.Scalar.QUOTE_DOUBLE) {
        const lineWidth = Math.max(ctx.options.lineWidth - ctx.indent.length, ctx.options.minContentWidth);
        const n = Math.ceil(str.length / lineWidth);
        const lines = new Array(n);
        for (let i = 0, o = 0;i < n; ++i, o += lineWidth) {
          lines[i] = str.substr(o, lineWidth);
        }
        str = lines.join(type === Scalar.Scalar.BLOCK_LITERAL ? `
` : " ");
      }
      return stringifyString.stringifyString({ comment, type, value: str }, ctx, onComment, onChompKeep);
    }
  };
  exports.binary = binary;
});

// node_modules/yaml/dist/schema/yaml-1.1/pairs.js
var require_pairs = __commonJS((exports) => {
  var identity = require_identity();
  var Pair = require_Pair();
  var Scalar = require_Scalar();
  var YAMLSeq = require_YAMLSeq();
  function resolvePairs(seq, onError) {
    if (identity.isSeq(seq)) {
      for (let i = 0;i < seq.items.length; ++i) {
        let item = seq.items[i];
        if (identity.isPair(item))
          continue;
        else if (identity.isMap(item)) {
          if (item.items.length > 1)
            onError("Each pair must have its own sequence indicator");
          const pair = item.items[0] || new Pair.Pair(new Scalar.Scalar(null));
          if (item.commentBefore)
            pair.key.commentBefore = pair.key.commentBefore ? `${item.commentBefore}
${pair.key.commentBefore}` : item.commentBefore;
          if (item.comment) {
            const cn = pair.value ?? pair.key;
            cn.comment = cn.comment ? `${item.comment}
${cn.comment}` : item.comment;
          }
          item = pair;
        }
        seq.items[i] = identity.isPair(item) ? item : new Pair.Pair(item);
      }
    } else
      onError("Expected a sequence for this tag");
    return seq;
  }
  function createPairs(schema, iterable, ctx) {
    const { replacer } = ctx;
    const pairs2 = new YAMLSeq.YAMLSeq(schema);
    pairs2.tag = "tag:yaml.org,2002:pairs";
    let i = 0;
    if (iterable && Symbol.iterator in Object(iterable))
      for (let it of iterable) {
        if (typeof replacer === "function")
          it = replacer.call(iterable, String(i++), it);
        let key, value;
        if (Array.isArray(it)) {
          if (it.length === 2) {
            key = it[0];
            value = it[1];
          } else
            throw new TypeError(`Expected [key, value] tuple: ${it}`);
        } else if (it && it instanceof Object) {
          const keys = Object.keys(it);
          if (keys.length === 1) {
            key = keys[0];
            value = it[key];
          } else {
            throw new TypeError(`Expected tuple with one key, not ${keys.length} keys`);
          }
        } else {
          key = it;
        }
        pairs2.items.push(Pair.createPair(key, value, ctx));
      }
    return pairs2;
  }
  var pairs = {
    collection: "seq",
    default: false,
    tag: "tag:yaml.org,2002:pairs",
    resolve: resolvePairs,
    createNode: createPairs
  };
  exports.createPairs = createPairs;
  exports.pairs = pairs;
  exports.resolvePairs = resolvePairs;
});

// node_modules/yaml/dist/schema/yaml-1.1/omap.js
var require_omap = __commonJS((exports) => {
  var identity = require_identity();
  var toJS = require_toJS();
  var YAMLMap = require_YAMLMap();
  var YAMLSeq = require_YAMLSeq();
  var pairs = require_pairs();

  class YAMLOMap extends YAMLSeq.YAMLSeq {
    constructor() {
      super();
      this.add = YAMLMap.YAMLMap.prototype.add.bind(this);
      this.delete = YAMLMap.YAMLMap.prototype.delete.bind(this);
      this.get = YAMLMap.YAMLMap.prototype.get.bind(this);
      this.has = YAMLMap.YAMLMap.prototype.has.bind(this);
      this.set = YAMLMap.YAMLMap.prototype.set.bind(this);
      this.tag = YAMLOMap.tag;
    }
    toJSON(_, ctx) {
      if (!ctx)
        return super.toJSON(_);
      const map = new Map;
      if (ctx?.onCreate)
        ctx.onCreate(map);
      for (const pair of this.items) {
        let key, value;
        if (identity.isPair(pair)) {
          key = toJS.toJS(pair.key, "", ctx);
          value = toJS.toJS(pair.value, key, ctx);
        } else {
          key = toJS.toJS(pair, "", ctx);
        }
        if (map.has(key))
          throw new Error("Ordered maps must not include duplicate keys");
        map.set(key, value);
      }
      return map;
    }
    static from(schema, iterable, ctx) {
      const pairs$1 = pairs.createPairs(schema, iterable, ctx);
      const omap2 = new this;
      omap2.items = pairs$1.items;
      return omap2;
    }
  }
  YAMLOMap.tag = "tag:yaml.org,2002:omap";
  var omap = {
    collection: "seq",
    identify: (value) => value instanceof Map,
    nodeClass: YAMLOMap,
    default: false,
    tag: "tag:yaml.org,2002:omap",
    resolve(seq, onError) {
      const pairs$1 = pairs.resolvePairs(seq, onError);
      const seenKeys = [];
      for (const { key } of pairs$1.items) {
        if (identity.isScalar(key)) {
          if (seenKeys.includes(key.value)) {
            onError(`Ordered maps must not include duplicate keys: ${key.value}`);
          } else {
            seenKeys.push(key.value);
          }
        }
      }
      return Object.assign(new YAMLOMap, pairs$1);
    },
    createNode: (schema, iterable, ctx) => YAMLOMap.from(schema, iterable, ctx)
  };
  exports.YAMLOMap = YAMLOMap;
  exports.omap = omap;
});

// node_modules/yaml/dist/schema/yaml-1.1/bool.js
var require_bool2 = __commonJS((exports) => {
  var Scalar = require_Scalar();
  function boolStringify({ value, source }, ctx) {
    const boolObj = value ? trueTag : falseTag;
    if (source && boolObj.test.test(source))
      return source;
    return value ? ctx.options.trueStr : ctx.options.falseStr;
  }
  var trueTag = {
    identify: (value) => value === true,
    default: true,
    tag: "tag:yaml.org,2002:bool",
    test: /^(?:Y|y|[Yy]es|YES|[Tt]rue|TRUE|[Oo]n|ON)$/,
    resolve: () => new Scalar.Scalar(true),
    stringify: boolStringify
  };
  var falseTag = {
    identify: (value) => value === false,
    default: true,
    tag: "tag:yaml.org,2002:bool",
    test: /^(?:N|n|[Nn]o|NO|[Ff]alse|FALSE|[Oo]ff|OFF)$/,
    resolve: () => new Scalar.Scalar(false),
    stringify: boolStringify
  };
  exports.falseTag = falseTag;
  exports.trueTag = trueTag;
});

// node_modules/yaml/dist/schema/yaml-1.1/float.js
var require_float2 = __commonJS((exports) => {
  var Scalar = require_Scalar();
  var stringifyNumber = require_stringifyNumber();
  var floatNaN = {
    identify: (value) => typeof value === "number",
    default: true,
    tag: "tag:yaml.org,2002:float",
    test: /^(?:[-+]?\.(?:inf|Inf|INF)|\.nan|\.NaN|\.NAN)$/,
    resolve: (str) => str.slice(-3).toLowerCase() === "nan" ? NaN : str[0] === "-" ? Number.NEGATIVE_INFINITY : Number.POSITIVE_INFINITY,
    stringify: stringifyNumber.stringifyNumber
  };
  var floatExp = {
    identify: (value) => typeof value === "number",
    default: true,
    tag: "tag:yaml.org,2002:float",
    format: "EXP",
    test: /^[-+]?(?:[0-9][0-9_]*)?(?:\.[0-9_]*)?[eE][-+]?[0-9]+$/,
    resolve: (str) => parseFloat(str.replace(/_/g, "")),
    stringify(node) {
      const num = Number(node.value);
      return isFinite(num) ? num.toExponential() : stringifyNumber.stringifyNumber(node);
    }
  };
  var float = {
    identify: (value) => typeof value === "number",
    default: true,
    tag: "tag:yaml.org,2002:float",
    test: /^[-+]?(?:[0-9][0-9_]*)?\.[0-9_]*$/,
    resolve(str) {
      const node = new Scalar.Scalar(parseFloat(str.replace(/_/g, "")));
      const dot = str.indexOf(".");
      if (dot !== -1) {
        const f = str.substring(dot + 1).replace(/_/g, "");
        if (f[f.length - 1] === "0")
          node.minFractionDigits = f.length;
      }
      return node;
    },
    stringify: stringifyNumber.stringifyNumber
  };
  exports.float = float;
  exports.floatExp = floatExp;
  exports.floatNaN = floatNaN;
});

// node_modules/yaml/dist/schema/yaml-1.1/int.js
var require_int2 = __commonJS((exports) => {
  var stringifyNumber = require_stringifyNumber();
  var intIdentify = (value) => typeof value === "bigint" || Number.isInteger(value);
  function intResolve(str, offset, radix, { intAsBigInt }) {
    const sign = str[0];
    if (sign === "-" || sign === "+")
      offset += 1;
    str = str.substring(offset).replace(/_/g, "");
    if (intAsBigInt) {
      switch (radix) {
        case 2:
          str = `0b${str}`;
          break;
        case 8:
          str = `0o${str}`;
          break;
        case 16:
          str = `0x${str}`;
          break;
      }
      const n2 = BigInt(str);
      return sign === "-" ? BigInt(-1) * n2 : n2;
    }
    const n = parseInt(str, radix);
    return sign === "-" ? -1 * n : n;
  }
  function intStringify(node, radix, prefix) {
    const { value } = node;
    if (intIdentify(value)) {
      const str = value.toString(radix);
      return value < 0 ? "-" + prefix + str.substr(1) : prefix + str;
    }
    return stringifyNumber.stringifyNumber(node);
  }
  var intBin = {
    identify: intIdentify,
    default: true,
    tag: "tag:yaml.org,2002:int",
    format: "BIN",
    test: /^[-+]?0b[0-1_]+$/,
    resolve: (str, _onError, opt) => intResolve(str, 2, 2, opt),
    stringify: (node) => intStringify(node, 2, "0b")
  };
  var intOct = {
    identify: intIdentify,
    default: true,
    tag: "tag:yaml.org,2002:int",
    format: "OCT",
    test: /^[-+]?0[0-7_]+$/,
    resolve: (str, _onError, opt) => intResolve(str, 1, 8, opt),
    stringify: (node) => intStringify(node, 8, "0")
  };
  var int = {
    identify: intIdentify,
    default: true,
    tag: "tag:yaml.org,2002:int",
    test: /^[-+]?[0-9][0-9_]*$/,
    resolve: (str, _onError, opt) => intResolve(str, 0, 10, opt),
    stringify: stringifyNumber.stringifyNumber
  };
  var intHex = {
    identify: intIdentify,
    default: true,
    tag: "tag:yaml.org,2002:int",
    format: "HEX",
    test: /^[-+]?0x[0-9a-fA-F_]+$/,
    resolve: (str, _onError, opt) => intResolve(str, 2, 16, opt),
    stringify: (node) => intStringify(node, 16, "0x")
  };
  exports.int = int;
  exports.intBin = intBin;
  exports.intHex = intHex;
  exports.intOct = intOct;
});

// node_modules/yaml/dist/schema/yaml-1.1/set.js
var require_set = __commonJS((exports) => {
  var identity = require_identity();
  var Pair = require_Pair();
  var YAMLMap = require_YAMLMap();

  class YAMLSet extends YAMLMap.YAMLMap {
    constructor(schema) {
      super(schema);
      this.tag = YAMLSet.tag;
    }
    add(key) {
      let pair;
      if (identity.isPair(key))
        pair = key;
      else if (key && typeof key === "object" && "key" in key && "value" in key && key.value === null)
        pair = new Pair.Pair(key.key, null);
      else
        pair = new Pair.Pair(key, null);
      const prev = YAMLMap.findPair(this.items, pair.key);
      if (!prev)
        this.items.push(pair);
    }
    get(key, keepPair) {
      const pair = YAMLMap.findPair(this.items, key);
      return !keepPair && identity.isPair(pair) ? identity.isScalar(pair.key) ? pair.key.value : pair.key : pair;
    }
    set(key, value) {
      if (typeof value !== "boolean")
        throw new Error(`Expected boolean value for set(key, value) in a YAML set, not ${typeof value}`);
      const prev = YAMLMap.findPair(this.items, key);
      if (prev && !value) {
        this.items.splice(this.items.indexOf(prev), 1);
      } else if (!prev && value) {
        this.items.push(new Pair.Pair(key));
      }
    }
    toJSON(_, ctx) {
      return super.toJSON(_, ctx, Set);
    }
    toString(ctx, onComment, onChompKeep) {
      if (!ctx)
        return JSON.stringify(this);
      if (this.hasAllNullValues(true))
        return super.toString(Object.assign({}, ctx, { allNullValues: true }), onComment, onChompKeep);
      else
        throw new Error("Set items must all have null values");
    }
    static from(schema, iterable, ctx) {
      const { replacer } = ctx;
      const set2 = new this(schema);
      if (iterable && Symbol.iterator in Object(iterable))
        for (let value of iterable) {
          if (typeof replacer === "function")
            value = replacer.call(iterable, value, value);
          set2.items.push(Pair.createPair(value, null, ctx));
        }
      return set2;
    }
  }
  YAMLSet.tag = "tag:yaml.org,2002:set";
  var set = {
    collection: "map",
    identify: (value) => value instanceof Set,
    nodeClass: YAMLSet,
    default: false,
    tag: "tag:yaml.org,2002:set",
    createNode: (schema, iterable, ctx) => YAMLSet.from(schema, iterable, ctx),
    resolve(map, onError) {
      if (identity.isMap(map)) {
        if (map.hasAllNullValues(true))
          return Object.assign(new YAMLSet, map);
        else
          onError("Set items must all have null values");
      } else
        onError("Expected a mapping for this tag");
      return map;
    }
  };
  exports.YAMLSet = YAMLSet;
  exports.set = set;
});

// node_modules/yaml/dist/schema/yaml-1.1/timestamp.js
var require_timestamp = __commonJS((exports) => {
  var stringifyNumber = require_stringifyNumber();
  function parseSexagesimal(str, asBigInt) {
    const sign = str[0];
    const parts = sign === "-" || sign === "+" ? str.substring(1) : str;
    const num = (n) => asBigInt ? BigInt(n) : Number(n);
    const res = parts.replace(/_/g, "").split(":").reduce((res2, p) => res2 * num(60) + num(p), num(0));
    return sign === "-" ? num(-1) * res : res;
  }
  function stringifySexagesimal(node) {
    let { value } = node;
    let num = (n) => n;
    if (typeof value === "bigint")
      num = (n) => BigInt(n);
    else if (isNaN(value) || !isFinite(value))
      return stringifyNumber.stringifyNumber(node);
    let sign = "";
    if (value < 0) {
      sign = "-";
      value *= num(-1);
    }
    const _60 = num(60);
    const parts = [value % _60];
    if (value < 60) {
      parts.unshift(0);
    } else {
      value = (value - parts[0]) / _60;
      parts.unshift(value % _60);
      if (value >= 60) {
        value = (value - parts[0]) / _60;
        parts.unshift(value);
      }
    }
    return sign + parts.map((n) => String(n).padStart(2, "0")).join(":").replace(/000000\d*$/, "");
  }
  var intTime = {
    identify: (value) => typeof value === "bigint" || Number.isInteger(value),
    default: true,
    tag: "tag:yaml.org,2002:int",
    format: "TIME",
    test: /^[-+]?[0-9][0-9_]*(?::[0-5]?[0-9])+$/,
    resolve: (str, _onError, { intAsBigInt }) => parseSexagesimal(str, intAsBigInt),
    stringify: stringifySexagesimal
  };
  var floatTime = {
    identify: (value) => typeof value === "number",
    default: true,
    tag: "tag:yaml.org,2002:float",
    format: "TIME",
    test: /^[-+]?[0-9][0-9_]*(?::[0-5]?[0-9])+\.[0-9_]*$/,
    resolve: (str) => parseSexagesimal(str, false),
    stringify: stringifySexagesimal
  };
  var timestamp = {
    identify: (value) => value instanceof Date,
    default: true,
    tag: "tag:yaml.org,2002:timestamp",
    test: RegExp("^([0-9]{4})-([0-9]{1,2})-([0-9]{1,2})" + "(?:" + "(?:t|T|[ \\t]+)" + "([0-9]{1,2}):([0-9]{1,2}):([0-9]{1,2}(\\.[0-9]+)?)" + "(?:[ \\t]*(Z|[-+][012]?[0-9](?::[0-9]{2})?))?" + ")?$"),
    resolve(str) {
      const match = str.match(timestamp.test);
      if (!match)
        throw new Error("!!timestamp expects a date, starting with yyyy-mm-dd");
      const [, year, month, day, hour, minute, second] = match.map(Number);
      const millisec = match[7] ? Number((match[7] + "00").substr(1, 3)) : 0;
      let date = Date.UTC(year, month - 1, day, hour || 0, minute || 0, second || 0, millisec);
      const tz = match[8];
      if (tz && tz !== "Z") {
        let d = parseSexagesimal(tz, false);
        if (Math.abs(d) < 30)
          d *= 60;
        date -= 60000 * d;
      }
      return new Date(date);
    },
    stringify: ({ value }) => value?.toISOString().replace(/(T00:00:00)?\.000Z$/, "") ?? ""
  };
  exports.floatTime = floatTime;
  exports.intTime = intTime;
  exports.timestamp = timestamp;
});

// node_modules/yaml/dist/schema/yaml-1.1/schema.js
var require_schema3 = __commonJS((exports) => {
  var map = require_map();
  var _null = require_null();
  var seq = require_seq();
  var string = require_string();
  var binary = require_binary();
  var bool = require_bool2();
  var float = require_float2();
  var int = require_int2();
  var merge = require_merge();
  var omap = require_omap();
  var pairs = require_pairs();
  var set = require_set();
  var timestamp = require_timestamp();
  var schema = [
    map.map,
    seq.seq,
    string.string,
    _null.nullTag,
    bool.trueTag,
    bool.falseTag,
    int.intBin,
    int.intOct,
    int.int,
    int.intHex,
    float.floatNaN,
    float.floatExp,
    float.float,
    binary.binary,
    merge.merge,
    omap.omap,
    pairs.pairs,
    set.set,
    timestamp.intTime,
    timestamp.floatTime,
    timestamp.timestamp
  ];
  exports.schema = schema;
});

// node_modules/yaml/dist/schema/tags.js
var require_tags = __commonJS((exports) => {
  var map = require_map();
  var _null = require_null();
  var seq = require_seq();
  var string = require_string();
  var bool = require_bool();
  var float = require_float();
  var int = require_int();
  var schema = require_schema();
  var schema$1 = require_schema2();
  var binary = require_binary();
  var merge = require_merge();
  var omap = require_omap();
  var pairs = require_pairs();
  var schema$2 = require_schema3();
  var set = require_set();
  var timestamp = require_timestamp();
  var schemas = new Map([
    ["core", schema.schema],
    ["failsafe", [map.map, seq.seq, string.string]],
    ["json", schema$1.schema],
    ["yaml11", schema$2.schema],
    ["yaml-1.1", schema$2.schema]
  ]);
  var tagsByName = {
    binary: binary.binary,
    bool: bool.boolTag,
    float: float.float,
    floatExp: float.floatExp,
    floatNaN: float.floatNaN,
    floatTime: timestamp.floatTime,
    int: int.int,
    intHex: int.intHex,
    intOct: int.intOct,
    intTime: timestamp.intTime,
    map: map.map,
    merge: merge.merge,
    null: _null.nullTag,
    omap: omap.omap,
    pairs: pairs.pairs,
    seq: seq.seq,
    set: set.set,
    timestamp: timestamp.timestamp
  };
  var coreKnownTags = {
    "tag:yaml.org,2002:binary": binary.binary,
    "tag:yaml.org,2002:merge": merge.merge,
    "tag:yaml.org,2002:omap": omap.omap,
    "tag:yaml.org,2002:pairs": pairs.pairs,
    "tag:yaml.org,2002:set": set.set,
    "tag:yaml.org,2002:timestamp": timestamp.timestamp
  };
  function getTags(customTags, schemaName, addMergeTag) {
    const schemaTags = schemas.get(schemaName);
    if (schemaTags && !customTags) {
      return addMergeTag && !schemaTags.includes(merge.merge) ? schemaTags.concat(merge.merge) : schemaTags.slice();
    }
    let tags = schemaTags;
    if (!tags) {
      if (Array.isArray(customTags))
        tags = [];
      else {
        const keys = Array.from(schemas.keys()).filter((key) => key !== "yaml11").map((key) => JSON.stringify(key)).join(", ");
        throw new Error(`Unknown schema "${schemaName}"; use one of ${keys} or define customTags array`);
      }
    }
    if (Array.isArray(customTags)) {
      for (const tag of customTags)
        tags = tags.concat(tag);
    } else if (typeof customTags === "function") {
      tags = customTags(tags.slice());
    }
    if (addMergeTag)
      tags = tags.concat(merge.merge);
    return tags.reduce((tags2, tag) => {
      const tagObj = typeof tag === "string" ? tagsByName[tag] : tag;
      if (!tagObj) {
        const tagName = JSON.stringify(tag);
        const keys = Object.keys(tagsByName).map((key) => JSON.stringify(key)).join(", ");
        throw new Error(`Unknown custom tag ${tagName}; use one of ${keys}`);
      }
      if (!tags2.includes(tagObj))
        tags2.push(tagObj);
      return tags2;
    }, []);
  }
  exports.coreKnownTags = coreKnownTags;
  exports.getTags = getTags;
});

// node_modules/yaml/dist/schema/Schema.js
var require_Schema = __commonJS((exports) => {
  var identity = require_identity();
  var map = require_map();
  var seq = require_seq();
  var string = require_string();
  var tags = require_tags();
  var sortMapEntriesByKey = (a, b) => a.key < b.key ? -1 : a.key > b.key ? 1 : 0;

  class Schema {
    constructor({ compat, customTags, merge, resolveKnownTags, schema, sortMapEntries, toStringDefaults }) {
      this.compat = Array.isArray(compat) ? tags.getTags(compat, "compat") : compat ? tags.getTags(null, compat) : null;
      this.name = typeof schema === "string" && schema || "core";
      this.knownTags = resolveKnownTags ? tags.coreKnownTags : {};
      this.tags = tags.getTags(customTags, this.name, merge);
      this.toStringOptions = toStringDefaults ?? null;
      Object.defineProperty(this, identity.MAP, { value: map.map });
      Object.defineProperty(this, identity.SCALAR, { value: string.string });
      Object.defineProperty(this, identity.SEQ, { value: seq.seq });
      this.sortMapEntries = typeof sortMapEntries === "function" ? sortMapEntries : sortMapEntries === true ? sortMapEntriesByKey : null;
    }
    clone() {
      const copy = Object.create(Schema.prototype, Object.getOwnPropertyDescriptors(this));
      copy.tags = this.tags.slice();
      return copy;
    }
  }
  exports.Schema = Schema;
});

// node_modules/yaml/dist/stringify/stringifyDocument.js
var require_stringifyDocument = __commonJS((exports) => {
  var identity = require_identity();
  var stringify = require_stringify();
  var stringifyComment = require_stringifyComment();
  function stringifyDocument(doc, options) {
    const lines = [];
    let hasDirectives = options.directives === true;
    if (options.directives !== false && doc.directives) {
      const dir = doc.directives.toString(doc);
      if (dir) {
        lines.push(dir);
        hasDirectives = true;
      } else if (doc.directives.docStart)
        hasDirectives = true;
    }
    if (hasDirectives)
      lines.push("---");
    const ctx = stringify.createStringifyContext(doc, options);
    const { commentString } = ctx.options;
    if (doc.commentBefore) {
      if (lines.length !== 1)
        lines.unshift("");
      const cs = commentString(doc.commentBefore);
      lines.unshift(stringifyComment.indentComment(cs, ""));
    }
    let chompKeep = false;
    let contentComment = null;
    if (doc.contents) {
      if (identity.isNode(doc.contents)) {
        if (doc.contents.spaceBefore && hasDirectives)
          lines.push("");
        if (doc.contents.commentBefore) {
          const cs = commentString(doc.contents.commentBefore);
          lines.push(stringifyComment.indentComment(cs, ""));
        }
        ctx.forceBlockIndent = !!doc.comment;
        contentComment = doc.contents.comment;
      }
      const onChompKeep = contentComment ? undefined : () => chompKeep = true;
      let body = stringify.stringify(doc.contents, ctx, () => contentComment = null, onChompKeep);
      if (contentComment)
        body += stringifyComment.lineComment(body, "", commentString(contentComment));
      if ((body[0] === "|" || body[0] === ">") && lines[lines.length - 1] === "---") {
        lines[lines.length - 1] = `--- ${body}`;
      } else
        lines.push(body);
    } else {
      lines.push(stringify.stringify(doc.contents, ctx));
    }
    if (doc.directives?.docEnd) {
      if (doc.comment) {
        const cs = commentString(doc.comment);
        if (cs.includes(`
`)) {
          lines.push("...");
          lines.push(stringifyComment.indentComment(cs, ""));
        } else {
          lines.push(`... ${cs}`);
        }
      } else {
        lines.push("...");
      }
    } else {
      let dc = doc.comment;
      if (dc && chompKeep)
        dc = dc.replace(/^\n+/, "");
      if (dc) {
        if ((!chompKeep || contentComment) && lines[lines.length - 1] !== "")
          lines.push("");
        lines.push(stringifyComment.indentComment(commentString(dc), ""));
      }
    }
    return lines.join(`
`) + `
`;
  }
  exports.stringifyDocument = stringifyDocument;
});

// node_modules/yaml/dist/doc/Document.js
var require_Document = __commonJS((exports) => {
  var Alias = require_Alias();
  var Collection = require_Collection();
  var identity = require_identity();
  var Pair = require_Pair();
  var toJS = require_toJS();
  var Schema = require_Schema();
  var stringifyDocument = require_stringifyDocument();
  var anchors = require_anchors();
  var applyReviver = require_applyReviver();
  var createNode = require_createNode();
  var directives = require_directives();

  class Document {
    constructor(value, replacer, options) {
      this.commentBefore = null;
      this.comment = null;
      this.errors = [];
      this.warnings = [];
      Object.defineProperty(this, identity.NODE_TYPE, { value: identity.DOC });
      let _replacer = null;
      if (typeof replacer === "function" || Array.isArray(replacer)) {
        _replacer = replacer;
      } else if (options === undefined && replacer) {
        options = replacer;
        replacer = undefined;
      }
      const opt = Object.assign({
        intAsBigInt: false,
        keepSourceTokens: false,
        logLevel: "warn",
        prettyErrors: true,
        strict: true,
        stringKeys: false,
        uniqueKeys: true,
        version: "1.2"
      }, options);
      this.options = opt;
      let { version } = opt;
      if (options?._directives) {
        this.directives = options._directives.atDocument();
        if (this.directives.yaml.explicit)
          version = this.directives.yaml.version;
      } else
        this.directives = new directives.Directives({ version });
      this.setSchema(version, options);
      this.contents = value === undefined ? null : this.createNode(value, _replacer, options);
    }
    clone() {
      const copy = Object.create(Document.prototype, {
        [identity.NODE_TYPE]: { value: identity.DOC }
      });
      copy.commentBefore = this.commentBefore;
      copy.comment = this.comment;
      copy.errors = this.errors.slice();
      copy.warnings = this.warnings.slice();
      copy.options = Object.assign({}, this.options);
      if (this.directives)
        copy.directives = this.directives.clone();
      copy.schema = this.schema.clone();
      copy.contents = identity.isNode(this.contents) ? this.contents.clone(copy.schema) : this.contents;
      if (this.range)
        copy.range = this.range.slice();
      return copy;
    }
    add(value) {
      if (assertCollection(this.contents))
        this.contents.add(value);
    }
    addIn(path, value) {
      if (assertCollection(this.contents))
        this.contents.addIn(path, value);
    }
    createAlias(node, name) {
      if (!node.anchor) {
        const prev = anchors.anchorNames(this);
        node.anchor = !name || prev.has(name) ? anchors.findNewAnchor(name || "a", prev) : name;
      }
      return new Alias.Alias(node.anchor);
    }
    createNode(value, replacer, options) {
      let _replacer = undefined;
      if (typeof replacer === "function") {
        value = replacer.call({ "": value }, "", value);
        _replacer = replacer;
      } else if (Array.isArray(replacer)) {
        const keyToStr = (v) => typeof v === "number" || v instanceof String || v instanceof Number;
        const asStr = replacer.filter(keyToStr).map(String);
        if (asStr.length > 0)
          replacer = replacer.concat(asStr);
        _replacer = replacer;
      } else if (options === undefined && replacer) {
        options = replacer;
        replacer = undefined;
      }
      const { aliasDuplicateObjects, anchorPrefix, flow, keepUndefined, onTagObj, tag } = options ?? {};
      const { onAnchor, setAnchors, sourceObjects } = anchors.createNodeAnchors(this, anchorPrefix || "a");
      const ctx = {
        aliasDuplicateObjects: aliasDuplicateObjects ?? true,
        keepUndefined: keepUndefined ?? false,
        onAnchor,
        onTagObj,
        replacer: _replacer,
        schema: this.schema,
        sourceObjects
      };
      const node = createNode.createNode(value, tag, ctx);
      if (flow && identity.isCollection(node))
        node.flow = true;
      setAnchors();
      return node;
    }
    createPair(key, value, options = {}) {
      const k = this.createNode(key, null, options);
      const v = this.createNode(value, null, options);
      return new Pair.Pair(k, v);
    }
    delete(key) {
      return assertCollection(this.contents) ? this.contents.delete(key) : false;
    }
    deleteIn(path) {
      if (Collection.isEmptyPath(path)) {
        if (this.contents == null)
          return false;
        this.contents = null;
        return true;
      }
      return assertCollection(this.contents) ? this.contents.deleteIn(path) : false;
    }
    get(key, keepScalar) {
      return identity.isCollection(this.contents) ? this.contents.get(key, keepScalar) : undefined;
    }
    getIn(path, keepScalar) {
      if (Collection.isEmptyPath(path))
        return !keepScalar && identity.isScalar(this.contents) ? this.contents.value : this.contents;
      return identity.isCollection(this.contents) ? this.contents.getIn(path, keepScalar) : undefined;
    }
    has(key) {
      return identity.isCollection(this.contents) ? this.contents.has(key) : false;
    }
    hasIn(path) {
      if (Collection.isEmptyPath(path))
        return this.contents !== undefined;
      return identity.isCollection(this.contents) ? this.contents.hasIn(path) : false;
    }
    set(key, value) {
      if (this.contents == null) {
        this.contents = Collection.collectionFromPath(this.schema, [key], value);
      } else if (assertCollection(this.contents)) {
        this.contents.set(key, value);
      }
    }
    setIn(path, value) {
      if (Collection.isEmptyPath(path)) {
        this.contents = value;
      } else if (this.contents == null) {
        this.contents = Collection.collectionFromPath(this.schema, Array.from(path), value);
      } else if (assertCollection(this.contents)) {
        this.contents.setIn(path, value);
      }
    }
    setSchema(version, options = {}) {
      if (typeof version === "number")
        version = String(version);
      let opt;
      switch (version) {
        case "1.1":
          if (this.directives)
            this.directives.yaml.version = "1.1";
          else
            this.directives = new directives.Directives({ version: "1.1" });
          opt = { resolveKnownTags: false, schema: "yaml-1.1" };
          break;
        case "1.2":
        case "next":
          if (this.directives)
            this.directives.yaml.version = version;
          else
            this.directives = new directives.Directives({ version });
          opt = { resolveKnownTags: true, schema: "core" };
          break;
        case null:
          if (this.directives)
            delete this.directives;
          opt = null;
          break;
        default: {
          const sv = JSON.stringify(version);
          throw new Error(`Expected '1.1', '1.2' or null as first argument, but found: ${sv}`);
        }
      }
      if (options.schema instanceof Object)
        this.schema = options.schema;
      else if (opt)
        this.schema = new Schema.Schema(Object.assign(opt, options));
      else
        throw new Error(`With a null YAML version, the { schema: Schema } option is required`);
    }
    toJS({ json, jsonArg, mapAsMap, maxAliasCount, onAnchor, reviver } = {}) {
      const ctx = {
        anchors: new Map,
        doc: this,
        keep: !json,
        mapAsMap: mapAsMap === true,
        mapKeyWarned: false,
        maxAliasCount: typeof maxAliasCount === "number" ? maxAliasCount : 100
      };
      const res = toJS.toJS(this.contents, jsonArg ?? "", ctx);
      if (typeof onAnchor === "function")
        for (const { count, res: res2 } of ctx.anchors.values())
          onAnchor(res2, count);
      return typeof reviver === "function" ? applyReviver.applyReviver(reviver, { "": res }, "", res) : res;
    }
    toJSON(jsonArg, onAnchor) {
      return this.toJS({ json: true, jsonArg, mapAsMap: false, onAnchor });
    }
    toString(options = {}) {
      if (this.errors.length > 0)
        throw new Error("Document with errors cannot be stringified");
      if ("indent" in options && (!Number.isInteger(options.indent) || Number(options.indent) <= 0)) {
        const s = JSON.stringify(options.indent);
        throw new Error(`"indent" option must be a positive integer, not ${s}`);
      }
      return stringifyDocument.stringifyDocument(this, options);
    }
  }
  function assertCollection(contents) {
    if (identity.isCollection(contents))
      return true;
    throw new Error("Expected a YAML collection as document contents");
  }
  exports.Document = Document;
});

// node_modules/yaml/dist/errors.js
var require_errors = __commonJS((exports) => {
  class YAMLError extends Error {
    constructor(name, pos, code, message) {
      super();
      this.name = name;
      this.code = code;
      this.message = message;
      this.pos = pos;
    }
  }

  class YAMLParseError extends YAMLError {
    constructor(pos, code, message) {
      super("YAMLParseError", pos, code, message);
    }
  }

  class YAMLWarning extends YAMLError {
    constructor(pos, code, message) {
      super("YAMLWarning", pos, code, message);
    }
  }
  var prettifyError = (src, lc) => (error) => {
    if (error.pos[0] === -1)
      return;
    error.linePos = error.pos.map((pos) => lc.linePos(pos));
    const { line, col } = error.linePos[0];
    error.message += ` at line ${line}, column ${col}`;
    let ci = col - 1;
    let lineStr = src.substring(lc.lineStarts[line - 1], lc.lineStarts[line]).replace(/[\n\r]+$/, "");
    if (ci >= 60 && lineStr.length > 80) {
      const trimStart = Math.min(ci - 39, lineStr.length - 79);
      lineStr = "…" + lineStr.substring(trimStart);
      ci -= trimStart - 1;
    }
    if (lineStr.length > 80)
      lineStr = lineStr.substring(0, 79) + "…";
    if (line > 1 && /^ *$/.test(lineStr.substring(0, ci))) {
      let prev = src.substring(lc.lineStarts[line - 2], lc.lineStarts[line - 1]);
      if (prev.length > 80)
        prev = prev.substring(0, 79) + `…
`;
      lineStr = prev + lineStr;
    }
    if (/[^ ]/.test(lineStr)) {
      let count = 1;
      const end = error.linePos[1];
      if (end?.line === line && end.col > col) {
        count = Math.max(1, Math.min(end.col - col, 80 - ci));
      }
      const pointer = " ".repeat(ci) + "^".repeat(count);
      error.message += `:

${lineStr}
${pointer}
`;
    }
  };
  exports.YAMLError = YAMLError;
  exports.YAMLParseError = YAMLParseError;
  exports.YAMLWarning = YAMLWarning;
  exports.prettifyError = prettifyError;
});

// node_modules/yaml/dist/compose/resolve-props.js
var require_resolve_props = __commonJS((exports) => {
  function resolveProps(tokens, { flow, indicator, next, offset, onError, parentIndent, startOnNewline }) {
    let spaceBefore = false;
    let atNewline = startOnNewline;
    let hasSpace = startOnNewline;
    let comment = "";
    let commentSep = "";
    let hasNewline = false;
    let reqSpace = false;
    let tab = null;
    let anchor = null;
    let tag = null;
    let newlineAfterProp = null;
    let comma = null;
    let found = null;
    let start = null;
    for (const token of tokens) {
      if (reqSpace) {
        if (token.type !== "space" && token.type !== "newline" && token.type !== "comma")
          onError(token.offset, "MISSING_CHAR", "Tags and anchors must be separated from the next token by white space");
        reqSpace = false;
      }
      if (tab) {
        if (atNewline && token.type !== "comment" && token.type !== "newline") {
          onError(tab, "TAB_AS_INDENT", "Tabs are not allowed as indentation");
        }
        tab = null;
      }
      switch (token.type) {
        case "space":
          if (!flow && (indicator !== "doc-start" || next?.type !== "flow-collection") && token.source.includes("\t")) {
            tab = token;
          }
          hasSpace = true;
          break;
        case "comment": {
          if (!hasSpace)
            onError(token, "MISSING_CHAR", "Comments must be separated from other tokens by white space characters");
          const cb = token.source.substring(1) || " ";
          if (!comment)
            comment = cb;
          else
            comment += commentSep + cb;
          commentSep = "";
          atNewline = false;
          break;
        }
        case "newline":
          if (atNewline) {
            if (comment)
              comment += token.source;
            else if (!found || indicator !== "seq-item-ind")
              spaceBefore = true;
          } else
            commentSep += token.source;
          atNewline = true;
          hasNewline = true;
          if (anchor || tag)
            newlineAfterProp = token;
          hasSpace = true;
          break;
        case "anchor":
          if (anchor)
            onError(token, "MULTIPLE_ANCHORS", "A node can have at most one anchor");
          if (token.source.endsWith(":"))
            onError(token.offset + token.source.length - 1, "BAD_ALIAS", "Anchor ending in : is ambiguous", true);
          anchor = token;
          start ?? (start = token.offset);
          atNewline = false;
          hasSpace = false;
          reqSpace = true;
          break;
        case "tag": {
          if (tag)
            onError(token, "MULTIPLE_TAGS", "A node can have at most one tag");
          tag = token;
          start ?? (start = token.offset);
          atNewline = false;
          hasSpace = false;
          reqSpace = true;
          break;
        }
        case indicator:
          if (anchor || tag)
            onError(token, "BAD_PROP_ORDER", `Anchors and tags must be after the ${token.source} indicator`);
          if (found)
            onError(token, "UNEXPECTED_TOKEN", `Unexpected ${token.source} in ${flow ?? "collection"}`);
          found = token;
          atNewline = indicator === "seq-item-ind" || indicator === "explicit-key-ind";
          hasSpace = false;
          break;
        case "comma":
          if (flow) {
            if (comma)
              onError(token, "UNEXPECTED_TOKEN", `Unexpected , in ${flow}`);
            comma = token;
            atNewline = false;
            hasSpace = false;
            break;
          }
        default:
          onError(token, "UNEXPECTED_TOKEN", `Unexpected ${token.type} token`);
          atNewline = false;
          hasSpace = false;
      }
    }
    const last = tokens[tokens.length - 1];
    const end = last ? last.offset + last.source.length : offset;
    if (reqSpace && next && next.type !== "space" && next.type !== "newline" && next.type !== "comma" && (next.type !== "scalar" || next.source !== "")) {
      onError(next.offset, "MISSING_CHAR", "Tags and anchors must be separated from the next token by white space");
    }
    if (tab && (atNewline && tab.indent <= parentIndent || next?.type === "block-map" || next?.type === "block-seq"))
      onError(tab, "TAB_AS_INDENT", "Tabs are not allowed as indentation");
    return {
      comma,
      found,
      spaceBefore,
      comment,
      hasNewline,
      anchor,
      tag,
      newlineAfterProp,
      end,
      start: start ?? end
    };
  }
  exports.resolveProps = resolveProps;
});

// node_modules/yaml/dist/compose/util-contains-newline.js
var require_util_contains_newline = __commonJS((exports) => {
  function containsNewline(key) {
    if (!key)
      return null;
    switch (key.type) {
      case "alias":
      case "scalar":
      case "double-quoted-scalar":
      case "single-quoted-scalar":
        if (key.source.includes(`
`))
          return true;
        if (key.end) {
          for (const st of key.end)
            if (st.type === "newline")
              return true;
        }
        return false;
      case "flow-collection":
        for (const it of key.items) {
          for (const st of it.start)
            if (st.type === "newline")
              return true;
          if (it.sep) {
            for (const st of it.sep)
              if (st.type === "newline")
                return true;
          }
          if (containsNewline(it.key) || containsNewline(it.value))
            return true;
        }
        return false;
      default:
        return true;
    }
  }
  exports.containsNewline = containsNewline;
});

// node_modules/yaml/dist/compose/util-flow-indent-check.js
var require_util_flow_indent_check = __commonJS((exports) => {
  var utilContainsNewline = require_util_contains_newline();
  function flowIndentCheck(indent, fc, onError) {
    if (fc?.type === "flow-collection") {
      const end = fc.end[0];
      if (end.indent === indent && (end.source === "]" || end.source === "}") && utilContainsNewline.containsNewline(fc)) {
        const msg = "Flow end indicator should be more indented than parent";
        onError(end, "BAD_INDENT", msg, true);
      }
    }
  }
  exports.flowIndentCheck = flowIndentCheck;
});

// node_modules/yaml/dist/compose/util-map-includes.js
var require_util_map_includes = __commonJS((exports) => {
  var identity = require_identity();
  function mapIncludes(ctx, items, search) {
    const { uniqueKeys } = ctx.options;
    if (uniqueKeys === false)
      return false;
    const isEqual = typeof uniqueKeys === "function" ? uniqueKeys : (a, b) => a === b || identity.isScalar(a) && identity.isScalar(b) && a.value === b.value;
    return items.some((pair) => isEqual(pair.key, search));
  }
  exports.mapIncludes = mapIncludes;
});

// node_modules/yaml/dist/compose/resolve-block-map.js
var require_resolve_block_map = __commonJS((exports) => {
  var Pair = require_Pair();
  var YAMLMap = require_YAMLMap();
  var resolveProps = require_resolve_props();
  var utilContainsNewline = require_util_contains_newline();
  var utilFlowIndentCheck = require_util_flow_indent_check();
  var utilMapIncludes = require_util_map_includes();
  var startColMsg = "All mapping items must start at the same column";
  function resolveBlockMap({ composeNode, composeEmptyNode }, ctx, bm, onError, tag) {
    const NodeClass = tag?.nodeClass ?? YAMLMap.YAMLMap;
    const map = new NodeClass(ctx.schema);
    if (ctx.atRoot)
      ctx.atRoot = false;
    let offset = bm.offset;
    let commentEnd = null;
    for (const collItem of bm.items) {
      const { start, key, sep, value } = collItem;
      const keyProps = resolveProps.resolveProps(start, {
        indicator: "explicit-key-ind",
        next: key ?? sep?.[0],
        offset,
        onError,
        parentIndent: bm.indent,
        startOnNewline: true
      });
      const implicitKey = !keyProps.found;
      if (implicitKey) {
        if (key) {
          if (key.type === "block-seq")
            onError(offset, "BLOCK_AS_IMPLICIT_KEY", "A block sequence may not be used as an implicit map key");
          else if ("indent" in key && key.indent !== bm.indent)
            onError(offset, "BAD_INDENT", startColMsg);
        }
        if (!keyProps.anchor && !keyProps.tag && !sep) {
          commentEnd = keyProps.end;
          if (keyProps.comment) {
            if (map.comment)
              map.comment += `
` + keyProps.comment;
            else
              map.comment = keyProps.comment;
          }
          continue;
        }
        if (keyProps.newlineAfterProp || utilContainsNewline.containsNewline(key)) {
          onError(key ?? start[start.length - 1], "MULTILINE_IMPLICIT_KEY", "Implicit keys need to be on a single line");
        }
      } else if (keyProps.found?.indent !== bm.indent) {
        onError(offset, "BAD_INDENT", startColMsg);
      }
      ctx.atKey = true;
      const keyStart = keyProps.end;
      const keyNode = key ? composeNode(ctx, key, keyProps, onError) : composeEmptyNode(ctx, keyStart, start, null, keyProps, onError);
      if (ctx.schema.compat)
        utilFlowIndentCheck.flowIndentCheck(bm.indent, key, onError);
      ctx.atKey = false;
      if (utilMapIncludes.mapIncludes(ctx, map.items, keyNode))
        onError(keyStart, "DUPLICATE_KEY", "Map keys must be unique");
      const valueProps = resolveProps.resolveProps(sep ?? [], {
        indicator: "map-value-ind",
        next: value,
        offset: keyNode.range[2],
        onError,
        parentIndent: bm.indent,
        startOnNewline: !key || key.type === "block-scalar"
      });
      offset = valueProps.end;
      if (valueProps.found) {
        if (implicitKey) {
          if (value?.type === "block-map" && !valueProps.hasNewline)
            onError(offset, "BLOCK_AS_IMPLICIT_KEY", "Nested mappings are not allowed in compact mappings");
          if (ctx.options.strict && keyProps.start < valueProps.found.offset - 1024)
            onError(keyNode.range, "KEY_OVER_1024_CHARS", "The : indicator must be at most 1024 chars after the start of an implicit block mapping key");
        }
        const valueNode = value ? composeNode(ctx, value, valueProps, onError) : composeEmptyNode(ctx, offset, sep, null, valueProps, onError);
        if (ctx.schema.compat)
          utilFlowIndentCheck.flowIndentCheck(bm.indent, value, onError);
        offset = valueNode.range[2];
        const pair = new Pair.Pair(keyNode, valueNode);
        if (ctx.options.keepSourceTokens)
          pair.srcToken = collItem;
        map.items.push(pair);
      } else {
        if (implicitKey)
          onError(keyNode.range, "MISSING_CHAR", "Implicit map keys need to be followed by map values");
        if (valueProps.comment) {
          if (keyNode.comment)
            keyNode.comment += `
` + valueProps.comment;
          else
            keyNode.comment = valueProps.comment;
        }
        const pair = new Pair.Pair(keyNode);
        if (ctx.options.keepSourceTokens)
          pair.srcToken = collItem;
        map.items.push(pair);
      }
    }
    if (commentEnd && commentEnd < offset)
      onError(commentEnd, "IMPOSSIBLE", "Map comment with trailing content");
    map.range = [bm.offset, offset, commentEnd ?? offset];
    return map;
  }
  exports.resolveBlockMap = resolveBlockMap;
});

// node_modules/yaml/dist/compose/resolve-block-seq.js
var require_resolve_block_seq = __commonJS((exports) => {
  var YAMLSeq = require_YAMLSeq();
  var resolveProps = require_resolve_props();
  var utilFlowIndentCheck = require_util_flow_indent_check();
  function resolveBlockSeq({ composeNode, composeEmptyNode }, ctx, bs, onError, tag) {
    const NodeClass = tag?.nodeClass ?? YAMLSeq.YAMLSeq;
    const seq = new NodeClass(ctx.schema);
    if (ctx.atRoot)
      ctx.atRoot = false;
    if (ctx.atKey)
      ctx.atKey = false;
    let offset = bs.offset;
    let commentEnd = null;
    for (const { start, value } of bs.items) {
      const props = resolveProps.resolveProps(start, {
        indicator: "seq-item-ind",
        next: value,
        offset,
        onError,
        parentIndent: bs.indent,
        startOnNewline: true
      });
      if (!props.found) {
        if (props.anchor || props.tag || value) {
          if (value?.type === "block-seq")
            onError(props.end, "BAD_INDENT", "All sequence items must start at the same column");
          else
            onError(offset, "MISSING_CHAR", "Sequence item without - indicator");
        } else {
          commentEnd = props.end;
          if (props.comment)
            seq.comment = props.comment;
          continue;
        }
      }
      const node = value ? composeNode(ctx, value, props, onError) : composeEmptyNode(ctx, props.end, start, null, props, onError);
      if (ctx.schema.compat)
        utilFlowIndentCheck.flowIndentCheck(bs.indent, value, onError);
      offset = node.range[2];
      seq.items.push(node);
    }
    seq.range = [bs.offset, offset, commentEnd ?? offset];
    return seq;
  }
  exports.resolveBlockSeq = resolveBlockSeq;
});

// node_modules/yaml/dist/compose/resolve-end.js
var require_resolve_end = __commonJS((exports) => {
  function resolveEnd(end, offset, reqSpace, onError) {
    let comment = "";
    if (end) {
      let hasSpace = false;
      let sep = "";
      for (const token of end) {
        const { source, type } = token;
        switch (type) {
          case "space":
            hasSpace = true;
            break;
          case "comment": {
            if (reqSpace && !hasSpace)
              onError(token, "MISSING_CHAR", "Comments must be separated from other tokens by white space characters");
            const cb = source.substring(1) || " ";
            if (!comment)
              comment = cb;
            else
              comment += sep + cb;
            sep = "";
            break;
          }
          case "newline":
            if (comment)
              sep += source;
            hasSpace = true;
            break;
          default:
            onError(token, "UNEXPECTED_TOKEN", `Unexpected ${type} at node end`);
        }
        offset += source.length;
      }
    }
    return { comment, offset };
  }
  exports.resolveEnd = resolveEnd;
});

// node_modules/yaml/dist/compose/resolve-flow-collection.js
var require_resolve_flow_collection = __commonJS((exports) => {
  var identity = require_identity();
  var Pair = require_Pair();
  var YAMLMap = require_YAMLMap();
  var YAMLSeq = require_YAMLSeq();
  var resolveEnd = require_resolve_end();
  var resolveProps = require_resolve_props();
  var utilContainsNewline = require_util_contains_newline();
  var utilMapIncludes = require_util_map_includes();
  var blockMsg = "Block collections are not allowed within flow collections";
  var isBlock = (token) => token && (token.type === "block-map" || token.type === "block-seq");
  function resolveFlowCollection({ composeNode, composeEmptyNode }, ctx, fc, onError, tag) {
    const isMap = fc.start.source === "{";
    const fcName = isMap ? "flow map" : "flow sequence";
    const NodeClass = tag?.nodeClass ?? (isMap ? YAMLMap.YAMLMap : YAMLSeq.YAMLSeq);
    const coll = new NodeClass(ctx.schema);
    coll.flow = true;
    const atRoot = ctx.atRoot;
    if (atRoot)
      ctx.atRoot = false;
    if (ctx.atKey)
      ctx.atKey = false;
    let offset = fc.offset + fc.start.source.length;
    for (let i = 0;i < fc.items.length; ++i) {
      const collItem = fc.items[i];
      const { start, key, sep, value } = collItem;
      const props = resolveProps.resolveProps(start, {
        flow: fcName,
        indicator: "explicit-key-ind",
        next: key ?? sep?.[0],
        offset,
        onError,
        parentIndent: fc.indent,
        startOnNewline: false
      });
      if (!props.found) {
        if (!props.anchor && !props.tag && !sep && !value) {
          if (i === 0 && props.comma)
            onError(props.comma, "UNEXPECTED_TOKEN", `Unexpected , in ${fcName}`);
          else if (i < fc.items.length - 1)
            onError(props.start, "UNEXPECTED_TOKEN", `Unexpected empty item in ${fcName}`);
          if (props.comment) {
            if (coll.comment)
              coll.comment += `
` + props.comment;
            else
              coll.comment = props.comment;
          }
          offset = props.end;
          continue;
        }
        if (!isMap && ctx.options.strict && utilContainsNewline.containsNewline(key))
          onError(key, "MULTILINE_IMPLICIT_KEY", "Implicit keys of flow sequence pairs need to be on a single line");
      }
      if (i === 0) {
        if (props.comma)
          onError(props.comma, "UNEXPECTED_TOKEN", `Unexpected , in ${fcName}`);
      } else {
        if (!props.comma)
          onError(props.start, "MISSING_CHAR", `Missing , between ${fcName} items`);
        if (props.comment) {
          let prevItemComment = "";
          loop:
            for (const st of start) {
              switch (st.type) {
                case "comma":
                case "space":
                  break;
                case "comment":
                  prevItemComment = st.source.substring(1);
                  break loop;
                default:
                  break loop;
              }
            }
          if (prevItemComment) {
            let prev = coll.items[coll.items.length - 1];
            if (identity.isPair(prev))
              prev = prev.value ?? prev.key;
            if (prev.comment)
              prev.comment += `
` + prevItemComment;
            else
              prev.comment = prevItemComment;
            props.comment = props.comment.substring(prevItemComment.length + 1);
          }
        }
      }
      if (!isMap && !sep && !props.found) {
        const valueNode = value ? composeNode(ctx, value, props, onError) : composeEmptyNode(ctx, props.end, sep, null, props, onError);
        coll.items.push(valueNode);
        offset = valueNode.range[2];
        if (isBlock(value))
          onError(valueNode.range, "BLOCK_IN_FLOW", blockMsg);
      } else {
        ctx.atKey = true;
        const keyStart = props.end;
        const keyNode = key ? composeNode(ctx, key, props, onError) : composeEmptyNode(ctx, keyStart, start, null, props, onError);
        if (isBlock(key))
          onError(keyNode.range, "BLOCK_IN_FLOW", blockMsg);
        ctx.atKey = false;
        const valueProps = resolveProps.resolveProps(sep ?? [], {
          flow: fcName,
          indicator: "map-value-ind",
          next: value,
          offset: keyNode.range[2],
          onError,
          parentIndent: fc.indent,
          startOnNewline: false
        });
        if (valueProps.found) {
          if (!isMap && !props.found && ctx.options.strict) {
            if (sep)
              for (const st of sep) {
                if (st === valueProps.found)
                  break;
                if (st.type === "newline") {
                  onError(st, "MULTILINE_IMPLICIT_KEY", "Implicit keys of flow sequence pairs need to be on a single line");
                  break;
                }
              }
            if (props.start < valueProps.found.offset - 1024)
              onError(valueProps.found, "KEY_OVER_1024_CHARS", "The : indicator must be at most 1024 chars after the start of an implicit flow sequence key");
          }
        } else if (value) {
          if ("source" in value && value.source?.[0] === ":")
            onError(value, "MISSING_CHAR", `Missing space after : in ${fcName}`);
          else
            onError(valueProps.start, "MISSING_CHAR", `Missing , or : between ${fcName} items`);
        }
        const valueNode = value ? composeNode(ctx, value, valueProps, onError) : valueProps.found ? composeEmptyNode(ctx, valueProps.end, sep, null, valueProps, onError) : null;
        if (valueNode) {
          if (isBlock(value))
            onError(valueNode.range, "BLOCK_IN_FLOW", blockMsg);
        } else if (valueProps.comment) {
          if (keyNode.comment)
            keyNode.comment += `
` + valueProps.comment;
          else
            keyNode.comment = valueProps.comment;
        }
        const pair = new Pair.Pair(keyNode, valueNode);
        if (ctx.options.keepSourceTokens)
          pair.srcToken = collItem;
        if (isMap) {
          const map = coll;
          if (utilMapIncludes.mapIncludes(ctx, map.items, keyNode))
            onError(keyStart, "DUPLICATE_KEY", "Map keys must be unique");
          map.items.push(pair);
        } else {
          const map = new YAMLMap.YAMLMap(ctx.schema);
          map.flow = true;
          map.items.push(pair);
          const endRange = (valueNode ?? keyNode).range;
          map.range = [keyNode.range[0], endRange[1], endRange[2]];
          coll.items.push(map);
        }
        offset = valueNode ? valueNode.range[2] : valueProps.end;
      }
    }
    const expectedEnd = isMap ? "}" : "]";
    const [ce, ...ee] = fc.end;
    let cePos = offset;
    if (ce?.source === expectedEnd)
      cePos = ce.offset + ce.source.length;
    else {
      const name = fcName[0].toUpperCase() + fcName.substring(1);
      const msg = atRoot ? `${name} must end with a ${expectedEnd}` : `${name} in block collection must be sufficiently indented and end with a ${expectedEnd}`;
      onError(offset, atRoot ? "MISSING_CHAR" : "BAD_INDENT", msg);
      if (ce && ce.source.length !== 1)
        ee.unshift(ce);
    }
    if (ee.length > 0) {
      const end = resolveEnd.resolveEnd(ee, cePos, ctx.options.strict, onError);
      if (end.comment) {
        if (coll.comment)
          coll.comment += `
` + end.comment;
        else
          coll.comment = end.comment;
      }
      coll.range = [fc.offset, cePos, end.offset];
    } else {
      coll.range = [fc.offset, cePos, cePos];
    }
    return coll;
  }
  exports.resolveFlowCollection = resolveFlowCollection;
});

// node_modules/yaml/dist/compose/compose-collection.js
var require_compose_collection = __commonJS((exports) => {
  var identity = require_identity();
  var Scalar = require_Scalar();
  var YAMLMap = require_YAMLMap();
  var YAMLSeq = require_YAMLSeq();
  var resolveBlockMap = require_resolve_block_map();
  var resolveBlockSeq = require_resolve_block_seq();
  var resolveFlowCollection = require_resolve_flow_collection();
  function resolveCollection(CN, ctx, token, onError, tagName, tag) {
    const coll = token.type === "block-map" ? resolveBlockMap.resolveBlockMap(CN, ctx, token, onError, tag) : token.type === "block-seq" ? resolveBlockSeq.resolveBlockSeq(CN, ctx, token, onError, tag) : resolveFlowCollection.resolveFlowCollection(CN, ctx, token, onError, tag);
    const Coll = coll.constructor;
    if (tagName === "!" || tagName === Coll.tagName) {
      coll.tag = Coll.tagName;
      return coll;
    }
    if (tagName)
      coll.tag = tagName;
    return coll;
  }
  function composeCollection(CN, ctx, token, props, onError) {
    const tagToken = props.tag;
    const tagName = !tagToken ? null : ctx.directives.tagName(tagToken.source, (msg) => onError(tagToken, "TAG_RESOLVE_FAILED", msg));
    if (token.type === "block-seq") {
      const { anchor, newlineAfterProp: nl } = props;
      const lastProp = anchor && tagToken ? anchor.offset > tagToken.offset ? anchor : tagToken : anchor ?? tagToken;
      if (lastProp && (!nl || nl.offset < lastProp.offset)) {
        const message = "Missing newline after block sequence props";
        onError(lastProp, "MISSING_CHAR", message);
      }
    }
    const expType = token.type === "block-map" ? "map" : token.type === "block-seq" ? "seq" : token.start.source === "{" ? "map" : "seq";
    if (!tagToken || !tagName || tagName === "!" || tagName === YAMLMap.YAMLMap.tagName && expType === "map" || tagName === YAMLSeq.YAMLSeq.tagName && expType === "seq") {
      return resolveCollection(CN, ctx, token, onError, tagName);
    }
    let tag = ctx.schema.tags.find((t) => t.tag === tagName && t.collection === expType);
    if (!tag) {
      const kt = ctx.schema.knownTags[tagName];
      if (kt?.collection === expType) {
        ctx.schema.tags.push(Object.assign({}, kt, { default: false }));
        tag = kt;
      } else {
        if (kt) {
          onError(tagToken, "BAD_COLLECTION_TYPE", `${kt.tag} used for ${expType} collection, but expects ${kt.collection ?? "scalar"}`, true);
        } else {
          onError(tagToken, "TAG_RESOLVE_FAILED", `Unresolved tag: ${tagName}`, true);
        }
        return resolveCollection(CN, ctx, token, onError, tagName);
      }
    }
    const coll = resolveCollection(CN, ctx, token, onError, tagName, tag);
    const res = tag.resolve?.(coll, (msg) => onError(tagToken, "TAG_RESOLVE_FAILED", msg), ctx.options) ?? coll;
    const node = identity.isNode(res) ? res : new Scalar.Scalar(res);
    node.range = coll.range;
    node.tag = tagName;
    if (tag?.format)
      node.format = tag.format;
    return node;
  }
  exports.composeCollection = composeCollection;
});

// node_modules/yaml/dist/compose/resolve-block-scalar.js
var require_resolve_block_scalar = __commonJS((exports) => {
  var Scalar = require_Scalar();
  function resolveBlockScalar(ctx, scalar, onError) {
    const start = scalar.offset;
    const header = parseBlockScalarHeader(scalar, ctx.options.strict, onError);
    if (!header)
      return { value: "", type: null, comment: "", range: [start, start, start] };
    const type = header.mode === ">" ? Scalar.Scalar.BLOCK_FOLDED : Scalar.Scalar.BLOCK_LITERAL;
    const lines = scalar.source ? splitLines(scalar.source) : [];
    let chompStart = lines.length;
    for (let i = lines.length - 1;i >= 0; --i) {
      const content = lines[i][1];
      if (content === "" || content === "\r")
        chompStart = i;
      else
        break;
    }
    if (chompStart === 0) {
      const value2 = header.chomp === "+" && lines.length > 0 ? `
`.repeat(Math.max(1, lines.length - 1)) : "";
      let end2 = start + header.length;
      if (scalar.source)
        end2 += scalar.source.length;
      return { value: value2, type, comment: header.comment, range: [start, end2, end2] };
    }
    let trimIndent = scalar.indent + header.indent;
    let offset = scalar.offset + header.length;
    let contentStart = 0;
    for (let i = 0;i < chompStart; ++i) {
      const [indent, content] = lines[i];
      if (content === "" || content === "\r") {
        if (header.indent === 0 && indent.length > trimIndent)
          trimIndent = indent.length;
      } else {
        if (indent.length < trimIndent) {
          const message = "Block scalars with more-indented leading empty lines must use an explicit indentation indicator";
          onError(offset + indent.length, "MISSING_CHAR", message);
        }
        if (header.indent === 0)
          trimIndent = indent.length;
        contentStart = i;
        if (trimIndent === 0 && !ctx.atRoot) {
          const message = "Block scalar values in collections must be indented";
          onError(offset, "BAD_INDENT", message);
        }
        break;
      }
      offset += indent.length + content.length + 1;
    }
    for (let i = lines.length - 1;i >= chompStart; --i) {
      if (lines[i][0].length > trimIndent)
        chompStart = i + 1;
    }
    let value = "";
    let sep = "";
    let prevMoreIndented = false;
    for (let i = 0;i < contentStart; ++i)
      value += lines[i][0].slice(trimIndent) + `
`;
    for (let i = contentStart;i < chompStart; ++i) {
      let [indent, content] = lines[i];
      offset += indent.length + content.length + 1;
      const crlf = content[content.length - 1] === "\r";
      if (crlf)
        content = content.slice(0, -1);
      if (content && indent.length < trimIndent) {
        const src = header.indent ? "explicit indentation indicator" : "first line";
        const message = `Block scalar lines must not be less indented than their ${src}`;
        onError(offset - content.length - (crlf ? 2 : 1), "BAD_INDENT", message);
        indent = "";
      }
      if (type === Scalar.Scalar.BLOCK_LITERAL) {
        value += sep + indent.slice(trimIndent) + content;
        sep = `
`;
      } else if (indent.length > trimIndent || content[0] === "\t") {
        if (sep === " ")
          sep = `
`;
        else if (!prevMoreIndented && sep === `
`)
          sep = `

`;
        value += sep + indent.slice(trimIndent) + content;
        sep = `
`;
        prevMoreIndented = true;
      } else if (content === "") {
        if (sep === `
`)
          value += `
`;
        else
          sep = `
`;
      } else {
        value += sep + content;
        sep = " ";
        prevMoreIndented = false;
      }
    }
    switch (header.chomp) {
      case "-":
        break;
      case "+":
        for (let i = chompStart;i < lines.length; ++i)
          value += `
` + lines[i][0].slice(trimIndent);
        if (value[value.length - 1] !== `
`)
          value += `
`;
        break;
      default:
        value += `
`;
    }
    const end = start + header.length + scalar.source.length;
    return { value, type, comment: header.comment, range: [start, end, end] };
  }
  function parseBlockScalarHeader({ offset, props }, strict, onError) {
    if (props[0].type !== "block-scalar-header") {
      onError(props[0], "IMPOSSIBLE", "Block scalar header not found");
      return null;
    }
    const { source } = props[0];
    const mode = source[0];
    let indent = 0;
    let chomp = "";
    let error = -1;
    for (let i = 1;i < source.length; ++i) {
      const ch = source[i];
      if (!chomp && (ch === "-" || ch === "+"))
        chomp = ch;
      else {
        const n = Number(ch);
        if (!indent && n)
          indent = n;
        else if (error === -1)
          error = offset + i;
      }
    }
    if (error !== -1)
      onError(error, "UNEXPECTED_TOKEN", `Block scalar header includes extra characters: ${source}`);
    let hasSpace = false;
    let comment = "";
    let length = source.length;
    for (let i = 1;i < props.length; ++i) {
      const token = props[i];
      switch (token.type) {
        case "space":
          hasSpace = true;
        case "newline":
          length += token.source.length;
          break;
        case "comment":
          if (strict && !hasSpace) {
            const message = "Comments must be separated from other tokens by white space characters";
            onError(token, "MISSING_CHAR", message);
          }
          length += token.source.length;
          comment = token.source.substring(1);
          break;
        case "error":
          onError(token, "UNEXPECTED_TOKEN", token.message);
          length += token.source.length;
          break;
        default: {
          const message = `Unexpected token in block scalar header: ${token.type}`;
          onError(token, "UNEXPECTED_TOKEN", message);
          const ts = token.source;
          if (ts && typeof ts === "string")
            length += ts.length;
        }
      }
    }
    return { mode, indent, chomp, comment, length };
  }
  function splitLines(source) {
    const split = source.split(/\n( *)/);
    const first = split[0];
    const m = first.match(/^( *)/);
    const line0 = m?.[1] ? [m[1], first.slice(m[1].length)] : ["", first];
    const lines = [line0];
    for (let i = 1;i < split.length; i += 2)
      lines.push([split[i], split[i + 1]]);
    return lines;
  }
  exports.resolveBlockScalar = resolveBlockScalar;
});

// node_modules/yaml/dist/compose/resolve-flow-scalar.js
var require_resolve_flow_scalar = __commonJS((exports) => {
  var Scalar = require_Scalar();
  var resolveEnd = require_resolve_end();
  function resolveFlowScalar(scalar, strict, onError) {
    const { offset, type, source, end } = scalar;
    let _type;
    let value;
    const _onError = (rel, code, msg) => onError(offset + rel, code, msg);
    switch (type) {
      case "scalar":
        _type = Scalar.Scalar.PLAIN;
        value = plainValue(source, _onError);
        break;
      case "single-quoted-scalar":
        _type = Scalar.Scalar.QUOTE_SINGLE;
        value = singleQuotedValue(source, _onError);
        break;
      case "double-quoted-scalar":
        _type = Scalar.Scalar.QUOTE_DOUBLE;
        value = doubleQuotedValue(source, _onError);
        break;
      default:
        onError(scalar, "UNEXPECTED_TOKEN", `Expected a flow scalar value, but found: ${type}`);
        return {
          value: "",
          type: null,
          comment: "",
          range: [offset, offset + source.length, offset + source.length]
        };
    }
    const valueEnd = offset + source.length;
    const re = resolveEnd.resolveEnd(end, valueEnd, strict, onError);
    return {
      value,
      type: _type,
      comment: re.comment,
      range: [offset, valueEnd, re.offset]
    };
  }
  function plainValue(source, onError) {
    let badChar = "";
    switch (source[0]) {
      case "\t":
        badChar = "a tab character";
        break;
      case ",":
        badChar = "flow indicator character ,";
        break;
      case "%":
        badChar = "directive indicator character %";
        break;
      case "|":
      case ">": {
        badChar = `block scalar indicator ${source[0]}`;
        break;
      }
      case "@":
      case "`": {
        badChar = `reserved character ${source[0]}`;
        break;
      }
    }
    if (badChar)
      onError(0, "BAD_SCALAR_START", `Plain value cannot start with ${badChar}`);
    return foldLines(source);
  }
  function singleQuotedValue(source, onError) {
    if (source[source.length - 1] !== "'" || source.length === 1)
      onError(source.length, "MISSING_CHAR", "Missing closing 'quote");
    return foldLines(source.slice(1, -1)).replace(/''/g, "'");
  }
  function foldLines(source) {
    let first, line;
    try {
      first = new RegExp(`(.*?)(?<![ 	])[ 	]*\r?
`, "sy");
      line = new RegExp(`[ 	]*(.*?)(?:(?<![ 	])[ 	]*)?\r?
`, "sy");
    } catch {
      first = /(.*?)[ \t]*\r?\n/sy;
      line = /[ \t]*(.*?)[ \t]*\r?\n/sy;
    }
    let match = first.exec(source);
    if (!match)
      return source;
    let res = match[1];
    let sep = " ";
    let pos = first.lastIndex;
    line.lastIndex = pos;
    while (match = line.exec(source)) {
      if (match[1] === "") {
        if (sep === `
`)
          res += sep;
        else
          sep = `
`;
      } else {
        res += sep + match[1];
        sep = " ";
      }
      pos = line.lastIndex;
    }
    const last = /[ \t]*(.*)/sy;
    last.lastIndex = pos;
    match = last.exec(source);
    return res + sep + (match?.[1] ?? "");
  }
  function doubleQuotedValue(source, onError) {
    let res = "";
    for (let i = 1;i < source.length - 1; ++i) {
      const ch = source[i];
      if (ch === "\r" && source[i + 1] === `
`)
        continue;
      if (ch === `
`) {
        const { fold, offset } = foldNewline(source, i);
        res += fold;
        i = offset;
      } else if (ch === "\\") {
        let next = source[++i];
        const cc = escapeCodes[next];
        if (cc)
          res += cc;
        else if (next === `
`) {
          next = source[i + 1];
          while (next === " " || next === "\t")
            next = source[++i + 1];
        } else if (next === "\r" && source[i + 1] === `
`) {
          next = source[++i + 1];
          while (next === " " || next === "\t")
            next = source[++i + 1];
        } else if (next === "x" || next === "u" || next === "U") {
          const length = next === "x" ? 2 : next === "u" ? 4 : 8;
          res += parseCharCode(source, i + 1, length, onError);
          i += length;
        } else {
          const raw = source.substr(i - 1, 2);
          onError(i - 1, "BAD_DQ_ESCAPE", `Invalid escape sequence ${raw}`);
          res += raw;
        }
      } else if (ch === " " || ch === "\t") {
        const wsStart = i;
        let next = source[i + 1];
        while (next === " " || next === "\t")
          next = source[++i + 1];
        if (next !== `
` && !(next === "\r" && source[i + 2] === `
`))
          res += i > wsStart ? source.slice(wsStart, i + 1) : ch;
      } else {
        res += ch;
      }
    }
    if (source[source.length - 1] !== '"' || source.length === 1)
      onError(source.length, "MISSING_CHAR", 'Missing closing "quote');
    return res;
  }
  function foldNewline(source, offset) {
    let fold = "";
    let ch = source[offset + 1];
    while (ch === " " || ch === "\t" || ch === `
` || ch === "\r") {
      if (ch === "\r" && source[offset + 2] !== `
`)
        break;
      if (ch === `
`)
        fold += `
`;
      offset += 1;
      ch = source[offset + 1];
    }
    if (!fold)
      fold = " ";
    return { fold, offset };
  }
  var escapeCodes = {
    "0": "\x00",
    a: "\x07",
    b: "\b",
    e: "\x1B",
    f: "\f",
    n: `
`,
    r: "\r",
    t: "\t",
    v: "\v",
    N: "",
    _: " ",
    L: "\u2028",
    P: "\u2029",
    " ": " ",
    '"': '"',
    "/": "/",
    "\\": "\\",
    "\t": "\t"
  };
  function parseCharCode(source, offset, length, onError) {
    const cc = source.substr(offset, length);
    const ok = cc.length === length && /^[0-9a-fA-F]+$/.test(cc);
    const code = ok ? parseInt(cc, 16) : NaN;
    try {
      return String.fromCodePoint(code);
    } catch {
      const raw = source.substr(offset - 2, length + 2);
      onError(offset - 2, "BAD_DQ_ESCAPE", `Invalid escape sequence ${raw}`);
      return raw;
    }
  }
  exports.resolveFlowScalar = resolveFlowScalar;
});

// node_modules/yaml/dist/compose/compose-scalar.js
var require_compose_scalar = __commonJS((exports) => {
  var identity = require_identity();
  var Scalar = require_Scalar();
  var resolveBlockScalar = require_resolve_block_scalar();
  var resolveFlowScalar = require_resolve_flow_scalar();
  function composeScalar(ctx, token, tagToken, onError) {
    const { value, type, comment, range } = token.type === "block-scalar" ? resolveBlockScalar.resolveBlockScalar(ctx, token, onError) : resolveFlowScalar.resolveFlowScalar(token, ctx.options.strict, onError);
    const tagName = tagToken ? ctx.directives.tagName(tagToken.source, (msg) => onError(tagToken, "TAG_RESOLVE_FAILED", msg)) : null;
    let tag;
    if (ctx.options.stringKeys && ctx.atKey) {
      tag = ctx.schema[identity.SCALAR];
    } else if (tagName)
      tag = findScalarTagByName(ctx.schema, value, tagName, tagToken, onError);
    else if (token.type === "scalar")
      tag = findScalarTagByTest(ctx, value, token, onError);
    else
      tag = ctx.schema[identity.SCALAR];
    let scalar;
    try {
      const res = tag.resolve(value, (msg) => onError(tagToken ?? token, "TAG_RESOLVE_FAILED", msg), ctx.options);
      scalar = identity.isScalar(res) ? res : new Scalar.Scalar(res);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      onError(tagToken ?? token, "TAG_RESOLVE_FAILED", msg);
      scalar = new Scalar.Scalar(value);
    }
    scalar.range = range;
    scalar.source = value;
    if (type)
      scalar.type = type;
    if (tagName)
      scalar.tag = tagName;
    if (tag.format)
      scalar.format = tag.format;
    if (comment)
      scalar.comment = comment;
    return scalar;
  }
  function findScalarTagByName(schema, value, tagName, tagToken, onError) {
    if (tagName === "!")
      return schema[identity.SCALAR];
    const matchWithTest = [];
    for (const tag of schema.tags) {
      if (!tag.collection && tag.tag === tagName) {
        if (tag.default && tag.test)
          matchWithTest.push(tag);
        else
          return tag;
      }
    }
    for (const tag of matchWithTest)
      if (tag.test?.test(value))
        return tag;
    const kt = schema.knownTags[tagName];
    if (kt && !kt.collection) {
      schema.tags.push(Object.assign({}, kt, { default: false, test: undefined }));
      return kt;
    }
    onError(tagToken, "TAG_RESOLVE_FAILED", `Unresolved tag: ${tagName}`, tagName !== "tag:yaml.org,2002:str");
    return schema[identity.SCALAR];
  }
  function findScalarTagByTest({ atKey, directives, schema }, value, token, onError) {
    const tag = schema.tags.find((tag2) => (tag2.default === true || atKey && tag2.default === "key") && tag2.test?.test(value)) || schema[identity.SCALAR];
    if (schema.compat) {
      const compat = schema.compat.find((tag2) => tag2.default && tag2.test?.test(value)) ?? schema[identity.SCALAR];
      if (tag.tag !== compat.tag) {
        const ts = directives.tagString(tag.tag);
        const cs = directives.tagString(compat.tag);
        const msg = `Value may be parsed as either ${ts} or ${cs}`;
        onError(token, "TAG_RESOLVE_FAILED", msg, true);
      }
    }
    return tag;
  }
  exports.composeScalar = composeScalar;
});

// node_modules/yaml/dist/compose/util-empty-scalar-position.js
var require_util_empty_scalar_position = __commonJS((exports) => {
  function emptyScalarPosition(offset, before, pos) {
    if (before) {
      pos ?? (pos = before.length);
      for (let i = pos - 1;i >= 0; --i) {
        let st = before[i];
        switch (st.type) {
          case "space":
          case "comment":
          case "newline":
            offset -= st.source.length;
            continue;
        }
        st = before[++i];
        while (st?.type === "space") {
          offset += st.source.length;
          st = before[++i];
        }
        break;
      }
    }
    return offset;
  }
  exports.emptyScalarPosition = emptyScalarPosition;
});

// node_modules/yaml/dist/compose/compose-node.js
var require_compose_node = __commonJS((exports) => {
  var Alias = require_Alias();
  var identity = require_identity();
  var composeCollection = require_compose_collection();
  var composeScalar = require_compose_scalar();
  var resolveEnd = require_resolve_end();
  var utilEmptyScalarPosition = require_util_empty_scalar_position();
  var CN = { composeNode, composeEmptyNode };
  function composeNode(ctx, token, props, onError) {
    const atKey = ctx.atKey;
    const { spaceBefore, comment, anchor, tag } = props;
    let node;
    let isSrcToken = true;
    switch (token.type) {
      case "alias":
        node = composeAlias(ctx, token, onError);
        if (anchor || tag)
          onError(token, "ALIAS_PROPS", "An alias node must not specify any properties");
        break;
      case "scalar":
      case "single-quoted-scalar":
      case "double-quoted-scalar":
      case "block-scalar":
        node = composeScalar.composeScalar(ctx, token, tag, onError);
        if (anchor)
          node.anchor = anchor.source.substring(1);
        break;
      case "block-map":
      case "block-seq":
      case "flow-collection":
        try {
          node = composeCollection.composeCollection(CN, ctx, token, props, onError);
          if (anchor)
            node.anchor = anchor.source.substring(1);
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          onError(token, "RESOURCE_EXHAUSTION", message);
        }
        break;
      default: {
        const message = token.type === "error" ? token.message : `Unsupported token (type: ${token.type})`;
        onError(token, "UNEXPECTED_TOKEN", message);
        isSrcToken = false;
      }
    }
    node ?? (node = composeEmptyNode(ctx, token.offset, undefined, null, props, onError));
    if (anchor && node.anchor === "")
      onError(anchor, "BAD_ALIAS", "Anchor cannot be an empty string");
    if (atKey && ctx.options.stringKeys && (!identity.isScalar(node) || typeof node.value !== "string" || node.tag && node.tag !== "tag:yaml.org,2002:str")) {
      const msg = "With stringKeys, all keys must be strings";
      onError(tag ?? token, "NON_STRING_KEY", msg);
    }
    if (spaceBefore)
      node.spaceBefore = true;
    if (comment) {
      if (token.type === "scalar" && token.source === "")
        node.comment = comment;
      else
        node.commentBefore = comment;
    }
    if (ctx.options.keepSourceTokens && isSrcToken)
      node.srcToken = token;
    return node;
  }
  function composeEmptyNode(ctx, offset, before, pos, { spaceBefore, comment, anchor, tag, end }, onError) {
    const token = {
      type: "scalar",
      offset: utilEmptyScalarPosition.emptyScalarPosition(offset, before, pos),
      indent: -1,
      source: ""
    };
    const node = composeScalar.composeScalar(ctx, token, tag, onError);
    if (anchor) {
      node.anchor = anchor.source.substring(1);
      if (node.anchor === "")
        onError(anchor, "BAD_ALIAS", "Anchor cannot be an empty string");
    }
    if (spaceBefore)
      node.spaceBefore = true;
    if (comment) {
      node.comment = comment;
      node.range[2] = end;
    }
    return node;
  }
  function composeAlias({ options }, { offset, source, end }, onError) {
    const alias = new Alias.Alias(source.substring(1));
    if (alias.source === "")
      onError(offset, "BAD_ALIAS", "Alias cannot be an empty string");
    if (alias.source.endsWith(":"))
      onError(offset + source.length - 1, "BAD_ALIAS", "Alias ending in : is ambiguous", true);
    const valueEnd = offset + source.length;
    const re = resolveEnd.resolveEnd(end, valueEnd, options.strict, onError);
    alias.range = [offset, valueEnd, re.offset];
    if (re.comment)
      alias.comment = re.comment;
    return alias;
  }
  exports.composeEmptyNode = composeEmptyNode;
  exports.composeNode = composeNode;
});

// node_modules/yaml/dist/compose/compose-doc.js
var require_compose_doc = __commonJS((exports) => {
  var Document = require_Document();
  var composeNode = require_compose_node();
  var resolveEnd = require_resolve_end();
  var resolveProps = require_resolve_props();
  function composeDoc(options, directives, { offset, start, value, end }, onError) {
    const opts = Object.assign({ _directives: directives }, options);
    const doc = new Document.Document(undefined, opts);
    const ctx = {
      atKey: false,
      atRoot: true,
      directives: doc.directives,
      options: doc.options,
      schema: doc.schema
    };
    const props = resolveProps.resolveProps(start, {
      indicator: "doc-start",
      next: value ?? end?.[0],
      offset,
      onError,
      parentIndent: 0,
      startOnNewline: true
    });
    if (props.found) {
      doc.directives.docStart = true;
      if (value && (value.type === "block-map" || value.type === "block-seq") && !props.hasNewline)
        onError(props.end, "MISSING_CHAR", "Block collection cannot start on same line with directives-end marker");
    }
    doc.contents = value ? composeNode.composeNode(ctx, value, props, onError) : composeNode.composeEmptyNode(ctx, props.end, start, null, props, onError);
    const contentEnd = doc.contents.range[2];
    const re = resolveEnd.resolveEnd(end, contentEnd, false, onError);
    if (re.comment)
      doc.comment = re.comment;
    doc.range = [offset, contentEnd, re.offset];
    return doc;
  }
  exports.composeDoc = composeDoc;
});

// node_modules/yaml/dist/compose/composer.js
var require_composer = __commonJS((exports) => {
  var node_process = __require("process");
  var directives = require_directives();
  var Document = require_Document();
  var errors = require_errors();
  var identity = require_identity();
  var composeDoc = require_compose_doc();
  var resolveEnd = require_resolve_end();
  function getErrorPos(src) {
    if (typeof src === "number")
      return [src, src + 1];
    if (Array.isArray(src))
      return src.length === 2 ? src : [src[0], src[1]];
    const { offset, source } = src;
    return [offset, offset + (typeof source === "string" ? source.length : 1)];
  }
  function parsePrelude(prelude) {
    let comment = "";
    let atComment = false;
    let afterEmptyLine = false;
    for (let i = 0;i < prelude.length; ++i) {
      const source = prelude[i];
      switch (source[0]) {
        case "#":
          comment += (comment === "" ? "" : afterEmptyLine ? `

` : `
`) + (source.substring(1) || " ");
          atComment = true;
          afterEmptyLine = false;
          break;
        case "%":
          if (prelude[i + 1]?.[0] !== "#")
            i += 1;
          atComment = false;
          break;
        default:
          if (!atComment)
            afterEmptyLine = true;
          atComment = false;
      }
    }
    return { comment, afterEmptyLine };
  }

  class Composer {
    constructor(options = {}) {
      this.doc = null;
      this.atDirectives = false;
      this.prelude = [];
      this.errors = [];
      this.warnings = [];
      this.onError = (source, code, message, warning) => {
        const pos = getErrorPos(source);
        if (warning)
          this.warnings.push(new errors.YAMLWarning(pos, code, message));
        else
          this.errors.push(new errors.YAMLParseError(pos, code, message));
      };
      this.directives = new directives.Directives({ version: options.version || "1.2" });
      this.options = options;
    }
    decorate(doc, afterDoc) {
      const { comment, afterEmptyLine } = parsePrelude(this.prelude);
      if (comment) {
        const dc = doc.contents;
        if (afterDoc) {
          doc.comment = doc.comment ? `${doc.comment}
${comment}` : comment;
        } else if (afterEmptyLine || doc.directives.docStart || !dc) {
          doc.commentBefore = comment;
        } else if (identity.isCollection(dc) && !dc.flow && dc.items.length > 0) {
          let it = dc.items[0];
          if (identity.isPair(it))
            it = it.key;
          const cb = it.commentBefore;
          it.commentBefore = cb ? `${comment}
${cb}` : comment;
        } else {
          const cb = dc.commentBefore;
          dc.commentBefore = cb ? `${comment}
${cb}` : comment;
        }
      }
      if (afterDoc) {
        for (let i = 0;i < this.errors.length; ++i)
          doc.errors.push(this.errors[i]);
        for (let i = 0;i < this.warnings.length; ++i)
          doc.warnings.push(this.warnings[i]);
      } else {
        doc.errors = this.errors;
        doc.warnings = this.warnings;
      }
      this.prelude = [];
      this.errors = [];
      this.warnings = [];
    }
    streamInfo() {
      return {
        comment: parsePrelude(this.prelude).comment,
        directives: this.directives,
        errors: this.errors,
        warnings: this.warnings
      };
    }
    *compose(tokens, forceDoc = false, endOffset = -1) {
      for (const token of tokens)
        yield* this.next(token);
      yield* this.end(forceDoc, endOffset);
    }
    *next(token) {
      if (node_process.env.LOG_STREAM)
        console.dir(token, { depth: null });
      switch (token.type) {
        case "directive":
          this.directives.add(token.source, (offset, message, warning) => {
            const pos = getErrorPos(token);
            pos[0] += offset;
            this.onError(pos, "BAD_DIRECTIVE", message, warning);
          });
          this.prelude.push(token.source);
          this.atDirectives = true;
          break;
        case "document": {
          const doc = composeDoc.composeDoc(this.options, this.directives, token, this.onError);
          if (this.atDirectives && !doc.directives.docStart)
            this.onError(token, "MISSING_CHAR", "Missing directives-end/doc-start indicator line");
          this.decorate(doc, false);
          if (this.doc)
            yield this.doc;
          this.doc = doc;
          this.atDirectives = false;
          break;
        }
        case "byte-order-mark":
        case "space":
          break;
        case "comment":
        case "newline":
          this.prelude.push(token.source);
          break;
        case "error": {
          const msg = token.source ? `${token.message}: ${JSON.stringify(token.source)}` : token.message;
          const error = new errors.YAMLParseError(getErrorPos(token), "UNEXPECTED_TOKEN", msg);
          if (this.atDirectives || !this.doc)
            this.errors.push(error);
          else
            this.doc.errors.push(error);
          break;
        }
        case "doc-end": {
          if (!this.doc) {
            const msg = "Unexpected doc-end without preceding document";
            this.errors.push(new errors.YAMLParseError(getErrorPos(token), "UNEXPECTED_TOKEN", msg));
            break;
          }
          this.doc.directives.docEnd = true;
          const end = resolveEnd.resolveEnd(token.end, token.offset + token.source.length, this.doc.options.strict, this.onError);
          this.decorate(this.doc, true);
          if (end.comment) {
            const dc = this.doc.comment;
            this.doc.comment = dc ? `${dc}
${end.comment}` : end.comment;
          }
          this.doc.range[2] = end.offset;
          break;
        }
        default:
          this.errors.push(new errors.YAMLParseError(getErrorPos(token), "UNEXPECTED_TOKEN", `Unsupported token ${token.type}`));
      }
    }
    *end(forceDoc = false, endOffset = -1) {
      if (this.doc) {
        this.decorate(this.doc, true);
        yield this.doc;
        this.doc = null;
      } else if (forceDoc) {
        const opts = Object.assign({ _directives: this.directives }, this.options);
        const doc = new Document.Document(undefined, opts);
        if (this.atDirectives)
          this.onError(endOffset, "MISSING_CHAR", "Missing directives-end indicator line");
        doc.range = [0, endOffset, endOffset];
        this.decorate(doc, false);
        yield doc;
      }
    }
  }
  exports.Composer = Composer;
});

// node_modules/yaml/dist/parse/cst-scalar.js
var require_cst_scalar = __commonJS((exports) => {
  var resolveBlockScalar = require_resolve_block_scalar();
  var resolveFlowScalar = require_resolve_flow_scalar();
  var errors = require_errors();
  var stringifyString = require_stringifyString();
  function resolveAsScalar(token, strict = true, onError) {
    if (token) {
      const _onError = (pos, code, message) => {
        const offset = typeof pos === "number" ? pos : Array.isArray(pos) ? pos[0] : pos.offset;
        if (onError)
          onError(offset, code, message);
        else
          throw new errors.YAMLParseError([offset, offset + 1], code, message);
      };
      switch (token.type) {
        case "scalar":
        case "single-quoted-scalar":
        case "double-quoted-scalar":
          return resolveFlowScalar.resolveFlowScalar(token, strict, _onError);
        case "block-scalar":
          return resolveBlockScalar.resolveBlockScalar({ options: { strict } }, token, _onError);
      }
    }
    return null;
  }
  function createScalarToken(value, context) {
    const { implicitKey = false, indent, inFlow = false, offset = -1, type = "PLAIN" } = context;
    const source = stringifyString.stringifyString({ type, value }, {
      implicitKey,
      indent: indent > 0 ? " ".repeat(indent) : "",
      inFlow,
      options: { blockQuote: true, lineWidth: -1 }
    });
    const end = context.end ?? [
      { type: "newline", offset: -1, indent, source: `
` }
    ];
    switch (source[0]) {
      case "|":
      case ">": {
        const he = source.indexOf(`
`);
        const head = source.substring(0, he);
        const body = source.substring(he + 1) + `
`;
        const props = [
          { type: "block-scalar-header", offset, indent, source: head }
        ];
        if (!addEndtoBlockProps(props, end))
          props.push({ type: "newline", offset: -1, indent, source: `
` });
        return { type: "block-scalar", offset, indent, props, source: body };
      }
      case '"':
        return { type: "double-quoted-scalar", offset, indent, source, end };
      case "'":
        return { type: "single-quoted-scalar", offset, indent, source, end };
      default:
        return { type: "scalar", offset, indent, source, end };
    }
  }
  function setScalarValue(token, value, context = {}) {
    let { afterKey = false, implicitKey = false, inFlow = false, type } = context;
    let indent = "indent" in token ? token.indent : null;
    if (afterKey && typeof indent === "number")
      indent += 2;
    if (!type)
      switch (token.type) {
        case "single-quoted-scalar":
          type = "QUOTE_SINGLE";
          break;
        case "double-quoted-scalar":
          type = "QUOTE_DOUBLE";
          break;
        case "block-scalar": {
          const header = token.props[0];
          if (header.type !== "block-scalar-header")
            throw new Error("Invalid block scalar header");
          type = header.source[0] === ">" ? "BLOCK_FOLDED" : "BLOCK_LITERAL";
          break;
        }
        default:
          type = "PLAIN";
      }
    const source = stringifyString.stringifyString({ type, value }, {
      implicitKey: implicitKey || indent === null,
      indent: indent !== null && indent > 0 ? " ".repeat(indent) : "",
      inFlow,
      options: { blockQuote: true, lineWidth: -1 }
    });
    switch (source[0]) {
      case "|":
      case ">":
        setBlockScalarValue(token, source);
        break;
      case '"':
        setFlowScalarValue(token, source, "double-quoted-scalar");
        break;
      case "'":
        setFlowScalarValue(token, source, "single-quoted-scalar");
        break;
      default:
        setFlowScalarValue(token, source, "scalar");
    }
  }
  function setBlockScalarValue(token, source) {
    const he = source.indexOf(`
`);
    const head = source.substring(0, he);
    const body = source.substring(he + 1) + `
`;
    if (token.type === "block-scalar") {
      const header = token.props[0];
      if (header.type !== "block-scalar-header")
        throw new Error("Invalid block scalar header");
      header.source = head;
      token.source = body;
    } else {
      const { offset } = token;
      const indent = "indent" in token ? token.indent : -1;
      const props = [
        { type: "block-scalar-header", offset, indent, source: head }
      ];
      if (!addEndtoBlockProps(props, "end" in token ? token.end : undefined))
        props.push({ type: "newline", offset: -1, indent, source: `
` });
      for (const key of Object.keys(token))
        if (key !== "type" && key !== "offset")
          delete token[key];
      Object.assign(token, { type: "block-scalar", indent, props, source: body });
    }
  }
  function addEndtoBlockProps(props, end) {
    if (end)
      for (const st of end)
        switch (st.type) {
          case "space":
          case "comment":
            props.push(st);
            break;
          case "newline":
            props.push(st);
            return true;
        }
    return false;
  }
  function setFlowScalarValue(token, source, type) {
    switch (token.type) {
      case "scalar":
      case "double-quoted-scalar":
      case "single-quoted-scalar":
        token.type = type;
        token.source = source;
        break;
      case "block-scalar": {
        const end = token.props.slice(1);
        let oa = source.length;
        if (token.props[0].type === "block-scalar-header")
          oa -= token.props[0].source.length;
        for (const tok of end)
          tok.offset += oa;
        delete token.props;
        Object.assign(token, { type, source, end });
        break;
      }
      case "block-map":
      case "block-seq": {
        const offset = token.offset + source.length;
        const nl = { type: "newline", offset, indent: token.indent, source: `
` };
        delete token.items;
        Object.assign(token, { type, source, end: [nl] });
        break;
      }
      default: {
        const indent = "indent" in token ? token.indent : -1;
        const end = "end" in token && Array.isArray(token.end) ? token.end.filter((st) => st.type === "space" || st.type === "comment" || st.type === "newline") : [];
        for (const key of Object.keys(token))
          if (key !== "type" && key !== "offset")
            delete token[key];
        Object.assign(token, { type, indent, source, end });
      }
    }
  }
  exports.createScalarToken = createScalarToken;
  exports.resolveAsScalar = resolveAsScalar;
  exports.setScalarValue = setScalarValue;
});

// node_modules/yaml/dist/parse/cst-stringify.js
var require_cst_stringify = __commonJS((exports) => {
  var stringify = (cst) => ("type" in cst) ? stringifyToken(cst) : stringifyItem(cst);
  function stringifyToken(token) {
    switch (token.type) {
      case "block-scalar": {
        let res = "";
        for (const tok of token.props)
          res += stringifyToken(tok);
        return res + token.source;
      }
      case "block-map":
      case "block-seq": {
        let res = "";
        for (const item of token.items)
          res += stringifyItem(item);
        return res;
      }
      case "flow-collection": {
        let res = token.start.source;
        for (const item of token.items)
          res += stringifyItem(item);
        for (const st of token.end)
          res += st.source;
        return res;
      }
      case "document": {
        let res = stringifyItem(token);
        if (token.end)
          for (const st of token.end)
            res += st.source;
        return res;
      }
      default: {
        let res = token.source;
        if ("end" in token && token.end)
          for (const st of token.end)
            res += st.source;
        return res;
      }
    }
  }
  function stringifyItem({ start, key, sep, value }) {
    let res = "";
    for (const st of start)
      res += st.source;
    if (key)
      res += stringifyToken(key);
    if (sep)
      for (const st of sep)
        res += st.source;
    if (value)
      res += stringifyToken(value);
    return res;
  }
  exports.stringify = stringify;
});

// node_modules/yaml/dist/parse/cst-visit.js
var require_cst_visit = __commonJS((exports) => {
  var BREAK = Symbol("break visit");
  var SKIP = Symbol("skip children");
  var REMOVE = Symbol("remove item");
  function visit(cst, visitor) {
    if ("type" in cst && cst.type === "document")
      cst = { start: cst.start, value: cst.value };
    _visit(Object.freeze([]), cst, visitor);
  }
  visit.BREAK = BREAK;
  visit.SKIP = SKIP;
  visit.REMOVE = REMOVE;
  visit.itemAtPath = (cst, path) => {
    let item = cst;
    for (const [field, index] of path) {
      const tok = item?.[field];
      if (tok && "items" in tok) {
        item = tok.items[index];
      } else
        return;
    }
    return item;
  };
  visit.parentCollection = (cst, path) => {
    const parent = visit.itemAtPath(cst, path.slice(0, -1));
    const field = path[path.length - 1][0];
    const coll = parent?.[field];
    if (coll && "items" in coll)
      return coll;
    throw new Error("Parent collection not found");
  };
  function _visit(path, item, visitor) {
    let ctrl = visitor(item, path);
    if (typeof ctrl === "symbol")
      return ctrl;
    for (const field of ["key", "value"]) {
      const token = item[field];
      if (token && "items" in token) {
        for (let i = 0;i < token.items.length; ++i) {
          const ci = _visit(Object.freeze(path.concat([[field, i]])), token.items[i], visitor);
          if (typeof ci === "number")
            i = ci - 1;
          else if (ci === BREAK)
            return BREAK;
          else if (ci === REMOVE) {
            token.items.splice(i, 1);
            i -= 1;
          }
        }
        if (typeof ctrl === "function" && field === "key")
          ctrl = ctrl(item, path);
      }
    }
    return typeof ctrl === "function" ? ctrl(item, path) : ctrl;
  }
  exports.visit = visit;
});

// node_modules/yaml/dist/parse/cst.js
var require_cst = __commonJS((exports) => {
  var cstScalar = require_cst_scalar();
  var cstStringify = require_cst_stringify();
  var cstVisit = require_cst_visit();
  var BOM = "\uFEFF";
  var DOCUMENT = "\x02";
  var FLOW_END = "\x18";
  var SCALAR = "\x1F";
  var isCollection = (token) => !!token && ("items" in token);
  var isScalar = (token) => !!token && (token.type === "scalar" || token.type === "single-quoted-scalar" || token.type === "double-quoted-scalar" || token.type === "block-scalar");
  function prettyToken(token) {
    switch (token) {
      case BOM:
        return "<BOM>";
      case DOCUMENT:
        return "<DOC>";
      case FLOW_END:
        return "<FLOW_END>";
      case SCALAR:
        return "<SCALAR>";
      default:
        return JSON.stringify(token);
    }
  }
  function tokenType(source) {
    switch (source) {
      case BOM:
        return "byte-order-mark";
      case DOCUMENT:
        return "doc-mode";
      case FLOW_END:
        return "flow-error-end";
      case SCALAR:
        return "scalar";
      case "---":
        return "doc-start";
      case "...":
        return "doc-end";
      case "":
      case `
`:
      case `\r
`:
        return "newline";
      case "-":
        return "seq-item-ind";
      case "?":
        return "explicit-key-ind";
      case ":":
        return "map-value-ind";
      case "{":
        return "flow-map-start";
      case "}":
        return "flow-map-end";
      case "[":
        return "flow-seq-start";
      case "]":
        return "flow-seq-end";
      case ",":
        return "comma";
    }
    switch (source[0]) {
      case " ":
      case "\t":
        return "space";
      case "#":
        return "comment";
      case "%":
        return "directive-line";
      case "*":
        return "alias";
      case "&":
        return "anchor";
      case "!":
        return "tag";
      case "'":
        return "single-quoted-scalar";
      case '"':
        return "double-quoted-scalar";
      case "|":
      case ">":
        return "block-scalar-header";
    }
    return null;
  }
  exports.createScalarToken = cstScalar.createScalarToken;
  exports.resolveAsScalar = cstScalar.resolveAsScalar;
  exports.setScalarValue = cstScalar.setScalarValue;
  exports.stringify = cstStringify.stringify;
  exports.visit = cstVisit.visit;
  exports.BOM = BOM;
  exports.DOCUMENT = DOCUMENT;
  exports.FLOW_END = FLOW_END;
  exports.SCALAR = SCALAR;
  exports.isCollection = isCollection;
  exports.isScalar = isScalar;
  exports.prettyToken = prettyToken;
  exports.tokenType = tokenType;
});

// node_modules/yaml/dist/parse/lexer.js
var require_lexer = __commonJS((exports) => {
  var cst = require_cst();
  function isEmpty(ch) {
    switch (ch) {
      case undefined:
      case " ":
      case `
`:
      case "\r":
      case "\t":
        return true;
      default:
        return false;
    }
  }
  var hexDigits = new Set("0123456789ABCDEFabcdef");
  var tagChars = new Set("0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz-#;/?:@&=+$_.!~*'()");
  var flowIndicatorChars = new Set(",[]{}");
  var invalidAnchorChars = new Set(` ,[]{}
\r	`);
  var isNotAnchorChar = (ch) => !ch || invalidAnchorChars.has(ch);

  class Lexer {
    constructor() {
      this.atEnd = false;
      this.blockScalarIndent = -1;
      this.blockScalarKeep = false;
      this.buffer = "";
      this.flowKey = false;
      this.flowLevel = 0;
      this.indentNext = 0;
      this.indentValue = 0;
      this.lineEndPos = null;
      this.next = null;
      this.pos = 0;
    }
    *lex(source, incomplete = false) {
      if (source) {
        if (typeof source !== "string")
          throw TypeError("source is not a string");
        this.buffer = this.buffer ? this.buffer + source : source;
        this.lineEndPos = null;
      }
      this.atEnd = !incomplete;
      let next = this.next ?? "stream";
      while (next && (incomplete || this.hasChars(1)))
        next = yield* this.parseNext(next);
    }
    atLineEnd() {
      let i = this.pos;
      let ch = this.buffer[i];
      while (ch === " " || ch === "\t")
        ch = this.buffer[++i];
      if (!ch || ch === "#" || ch === `
`)
        return true;
      if (ch === "\r")
        return this.buffer[i + 1] === `
`;
      return false;
    }
    charAt(n) {
      return this.buffer[this.pos + n];
    }
    continueScalar(offset) {
      let ch = this.buffer[offset];
      if (this.indentNext > 0) {
        let indent = 0;
        while (ch === " ")
          ch = this.buffer[++indent + offset];
        if (ch === "\r") {
          const next = this.buffer[indent + offset + 1];
          if (next === `
` || !next && !this.atEnd)
            return offset + indent + 1;
        }
        return ch === `
` || indent >= this.indentNext || !ch && !this.atEnd ? offset + indent : -1;
      }
      if (ch === "-" || ch === ".") {
        const dt = this.buffer.substr(offset, 3);
        if ((dt === "---" || dt === "...") && isEmpty(this.buffer[offset + 3]))
          return -1;
      }
      return offset;
    }
    getLine() {
      let end = this.lineEndPos;
      if (typeof end !== "number" || end !== -1 && end < this.pos) {
        end = this.buffer.indexOf(`
`, this.pos);
        this.lineEndPos = end;
      }
      if (end === -1)
        return this.atEnd ? this.buffer.substring(this.pos) : null;
      if (this.buffer[end - 1] === "\r")
        end -= 1;
      return this.buffer.substring(this.pos, end);
    }
    hasChars(n) {
      return this.pos + n <= this.buffer.length;
    }
    setNext(state) {
      this.buffer = this.buffer.substring(this.pos);
      this.pos = 0;
      this.lineEndPos = null;
      this.next = state;
      return null;
    }
    peek(n) {
      return this.buffer.substr(this.pos, n);
    }
    *parseNext(next) {
      switch (next) {
        case "stream":
          return yield* this.parseStream();
        case "line-start":
          return yield* this.parseLineStart();
        case "block-start":
          return yield* this.parseBlockStart();
        case "doc":
          return yield* this.parseDocument();
        case "flow":
          return yield* this.parseFlowCollection();
        case "quoted-scalar":
          return yield* this.parseQuotedScalar();
        case "block-scalar":
          return yield* this.parseBlockScalar();
        case "plain-scalar":
          return yield* this.parsePlainScalar();
      }
    }
    *parseStream() {
      let line = this.getLine();
      if (line === null)
        return this.setNext("stream");
      if (line[0] === cst.BOM) {
        yield* this.pushCount(1);
        line = line.substring(1);
      }
      if (line[0] === "%") {
        let dirEnd = line.length;
        let cs = line.indexOf("#");
        while (cs !== -1) {
          const ch = line[cs - 1];
          if (ch === " " || ch === "\t") {
            dirEnd = cs - 1;
            break;
          } else {
            cs = line.indexOf("#", cs + 1);
          }
        }
        while (true) {
          const ch = line[dirEnd - 1];
          if (ch === " " || ch === "\t")
            dirEnd -= 1;
          else
            break;
        }
        const n = (yield* this.pushCount(dirEnd)) + (yield* this.pushSpaces(true));
        yield* this.pushCount(line.length - n);
        this.pushNewline();
        return "stream";
      }
      if (this.atLineEnd()) {
        const sp = yield* this.pushSpaces(true);
        yield* this.pushCount(line.length - sp);
        yield* this.pushNewline();
        return "stream";
      }
      yield cst.DOCUMENT;
      return yield* this.parseLineStart();
    }
    *parseLineStart() {
      const ch = this.charAt(0);
      if (!ch && !this.atEnd)
        return this.setNext("line-start");
      if (ch === "-" || ch === ".") {
        if (!this.atEnd && !this.hasChars(4))
          return this.setNext("line-start");
        const s = this.peek(3);
        if ((s === "---" || s === "...") && isEmpty(this.charAt(3))) {
          yield* this.pushCount(3);
          this.indentValue = 0;
          this.indentNext = 0;
          return s === "---" ? "doc" : "stream";
        }
      }
      this.indentValue = yield* this.pushSpaces(false);
      if (this.indentNext > this.indentValue && !isEmpty(this.charAt(1)))
        this.indentNext = this.indentValue;
      return yield* this.parseBlockStart();
    }
    *parseBlockStart() {
      const [ch0, ch1] = this.peek(2);
      if (!ch1 && !this.atEnd)
        return this.setNext("block-start");
      if ((ch0 === "-" || ch0 === "?" || ch0 === ":") && isEmpty(ch1)) {
        const n = (yield* this.pushCount(1)) + (yield* this.pushSpaces(true));
        this.indentNext = this.indentValue + 1;
        this.indentValue += n;
        return "block-start";
      }
      return "doc";
    }
    *parseDocument() {
      yield* this.pushSpaces(true);
      const line = this.getLine();
      if (line === null)
        return this.setNext("doc");
      let n = yield* this.pushIndicators();
      switch (line[n]) {
        case "#":
          yield* this.pushCount(line.length - n);
        case undefined:
          yield* this.pushNewline();
          return yield* this.parseLineStart();
        case "{":
        case "[":
          yield* this.pushCount(1);
          this.flowKey = false;
          this.flowLevel = 1;
          return "flow";
        case "}":
        case "]":
          yield* this.pushCount(1);
          return "doc";
        case "*":
          yield* this.pushUntil(isNotAnchorChar);
          return "doc";
        case '"':
        case "'":
          return yield* this.parseQuotedScalar();
        case "|":
        case ">":
          n += yield* this.parseBlockScalarHeader();
          n += yield* this.pushSpaces(true);
          yield* this.pushCount(line.length - n);
          yield* this.pushNewline();
          return yield* this.parseBlockScalar();
        default:
          return yield* this.parsePlainScalar();
      }
    }
    *parseFlowCollection() {
      let nl, sp;
      let indent = -1;
      do {
        nl = yield* this.pushNewline();
        if (nl > 0) {
          sp = yield* this.pushSpaces(false);
          this.indentValue = indent = sp;
        } else {
          sp = 0;
        }
        sp += yield* this.pushSpaces(true);
      } while (nl + sp > 0);
      const line = this.getLine();
      if (line === null)
        return this.setNext("flow");
      if (indent !== -1 && indent < this.indentNext && line[0] !== "#" || indent === 0 && (line.startsWith("---") || line.startsWith("...")) && isEmpty(line[3])) {
        const atFlowEndMarker = indent === this.indentNext - 1 && this.flowLevel === 1 && (line[0] === "]" || line[0] === "}");
        if (!atFlowEndMarker) {
          this.flowLevel = 0;
          yield cst.FLOW_END;
          return yield* this.parseLineStart();
        }
      }
      let n = 0;
      while (line[n] === ",") {
        n += yield* this.pushCount(1);
        n += yield* this.pushSpaces(true);
        this.flowKey = false;
      }
      n += yield* this.pushIndicators();
      switch (line[n]) {
        case undefined:
          return "flow";
        case "#":
          yield* this.pushCount(line.length - n);
          return "flow";
        case "{":
        case "[":
          yield* this.pushCount(1);
          this.flowKey = false;
          this.flowLevel += 1;
          return "flow";
        case "}":
        case "]":
          yield* this.pushCount(1);
          this.flowKey = true;
          this.flowLevel -= 1;
          return this.flowLevel ? "flow" : "doc";
        case "*":
          yield* this.pushUntil(isNotAnchorChar);
          return "flow";
        case '"':
        case "'":
          this.flowKey = true;
          return yield* this.parseQuotedScalar();
        case ":": {
          const next = this.charAt(1);
          if (this.flowKey || isEmpty(next) || next === ",") {
            this.flowKey = false;
            yield* this.pushCount(1);
            yield* this.pushSpaces(true);
            return "flow";
          }
        }
        default:
          this.flowKey = false;
          return yield* this.parsePlainScalar();
      }
    }
    *parseQuotedScalar() {
      const quote = this.charAt(0);
      let end = this.buffer.indexOf(quote, this.pos + 1);
      if (quote === "'") {
        while (end !== -1 && this.buffer[end + 1] === "'")
          end = this.buffer.indexOf("'", end + 2);
      } else {
        while (end !== -1) {
          let n = 0;
          while (this.buffer[end - 1 - n] === "\\")
            n += 1;
          if (n % 2 === 0)
            break;
          end = this.buffer.indexOf('"', end + 1);
        }
      }
      const qb = this.buffer.substring(0, end);
      let nl = qb.indexOf(`
`, this.pos);
      if (nl !== -1) {
        while (nl !== -1) {
          const cs = this.continueScalar(nl + 1);
          if (cs === -1)
            break;
          nl = qb.indexOf(`
`, cs);
        }
        if (nl !== -1) {
          end = nl - (qb[nl - 1] === "\r" ? 2 : 1);
        }
      }
      if (end === -1) {
        if (!this.atEnd)
          return this.setNext("quoted-scalar");
        end = this.buffer.length;
      }
      yield* this.pushToIndex(end + 1, false);
      return this.flowLevel ? "flow" : "doc";
    }
    *parseBlockScalarHeader() {
      this.blockScalarIndent = -1;
      this.blockScalarKeep = false;
      let i = this.pos;
      while (true) {
        const ch = this.buffer[++i];
        if (ch === "+")
          this.blockScalarKeep = true;
        else if (ch > "0" && ch <= "9")
          this.blockScalarIndent = Number(ch) - 1;
        else if (ch !== "-")
          break;
      }
      return yield* this.pushUntil((ch) => isEmpty(ch) || ch === "#");
    }
    *parseBlockScalar() {
      let nl = this.pos - 1;
      let indent = 0;
      let ch;
      loop:
        for (let i2 = this.pos;ch = this.buffer[i2]; ++i2) {
          switch (ch) {
            case " ":
              indent += 1;
              break;
            case `
`:
              nl = i2;
              indent = 0;
              break;
            case "\r": {
              const next = this.buffer[i2 + 1];
              if (!next && !this.atEnd)
                return this.setNext("block-scalar");
              if (next === `
`)
                break;
            }
            default:
              break loop;
          }
        }
      if (!ch && !this.atEnd)
        return this.setNext("block-scalar");
      if (indent >= this.indentNext) {
        if (this.blockScalarIndent === -1)
          this.indentNext = indent;
        else {
          this.indentNext = this.blockScalarIndent + (this.indentNext === 0 ? 1 : this.indentNext);
        }
        do {
          const cs = this.continueScalar(nl + 1);
          if (cs === -1)
            break;
          nl = this.buffer.indexOf(`
`, cs);
        } while (nl !== -1);
        if (nl === -1) {
          if (!this.atEnd)
            return this.setNext("block-scalar");
          nl = this.buffer.length;
        }
      }
      let i = nl + 1;
      ch = this.buffer[i];
      while (ch === " ")
        ch = this.buffer[++i];
      if (ch === "\t") {
        while (ch === "\t" || ch === " " || ch === "\r" || ch === `
`)
          ch = this.buffer[++i];
        nl = i - 1;
      } else if (!this.blockScalarKeep) {
        do {
          let i2 = nl - 1;
          let ch2 = this.buffer[i2];
          if (ch2 === "\r")
            ch2 = this.buffer[--i2];
          const lastChar = i2;
          while (ch2 === " ")
            ch2 = this.buffer[--i2];
          if (ch2 === `
` && i2 >= this.pos && i2 + 1 + indent > lastChar)
            nl = i2;
          else
            break;
        } while (true);
      }
      yield cst.SCALAR;
      yield* this.pushToIndex(nl + 1, true);
      return yield* this.parseLineStart();
    }
    *parsePlainScalar() {
      const inFlow = this.flowLevel > 0;
      let end = this.pos - 1;
      let i = this.pos - 1;
      let ch;
      while (ch = this.buffer[++i]) {
        if (ch === ":") {
          const next = this.buffer[i + 1];
          if (isEmpty(next) || inFlow && flowIndicatorChars.has(next))
            break;
          end = i;
        } else if (isEmpty(ch)) {
          let next = this.buffer[i + 1];
          if (ch === "\r") {
            if (next === `
`) {
              i += 1;
              ch = `
`;
              next = this.buffer[i + 1];
            } else
              end = i;
          }
          if (next === "#" || inFlow && flowIndicatorChars.has(next))
            break;
          if (ch === `
`) {
            const cs = this.continueScalar(i + 1);
            if (cs === -1)
              break;
            i = Math.max(i, cs - 2);
          }
        } else {
          if (inFlow && flowIndicatorChars.has(ch))
            break;
          end = i;
        }
      }
      if (!ch && !this.atEnd)
        return this.setNext("plain-scalar");
      yield cst.SCALAR;
      yield* this.pushToIndex(end + 1, true);
      return inFlow ? "flow" : "doc";
    }
    *pushCount(n) {
      if (n > 0) {
        yield this.buffer.substr(this.pos, n);
        this.pos += n;
        return n;
      }
      return 0;
    }
    *pushToIndex(i, allowEmpty) {
      const s = this.buffer.slice(this.pos, i);
      if (s) {
        yield s;
        this.pos += s.length;
        return s.length;
      } else if (allowEmpty)
        yield "";
      return 0;
    }
    *pushIndicators() {
      let n = 0;
      loop:
        while (true) {
          switch (this.charAt(0)) {
            case "!":
              n += yield* this.pushTag();
              n += yield* this.pushSpaces(true);
              continue loop;
            case "&":
              n += yield* this.pushUntil(isNotAnchorChar);
              n += yield* this.pushSpaces(true);
              continue loop;
            case "-":
            case "?":
            case ":": {
              const inFlow = this.flowLevel > 0;
              const ch1 = this.charAt(1);
              if (isEmpty(ch1) || inFlow && flowIndicatorChars.has(ch1)) {
                if (!inFlow)
                  this.indentNext = this.indentValue + 1;
                else if (this.flowKey)
                  this.flowKey = false;
                n += yield* this.pushCount(1);
                n += yield* this.pushSpaces(true);
                continue loop;
              }
            }
          }
          break loop;
        }
      return n;
    }
    *pushTag() {
      if (this.charAt(1) === "<") {
        let i = this.pos + 2;
        let ch = this.buffer[i];
        while (!isEmpty(ch) && ch !== ">")
          ch = this.buffer[++i];
        return yield* this.pushToIndex(ch === ">" ? i + 1 : i, false);
      } else {
        let i = this.pos + 1;
        let ch = this.buffer[i];
        while (ch) {
          if (tagChars.has(ch))
            ch = this.buffer[++i];
          else if (ch === "%" && hexDigits.has(this.buffer[i + 1]) && hexDigits.has(this.buffer[i + 2])) {
            ch = this.buffer[i += 3];
          } else
            break;
        }
        return yield* this.pushToIndex(i, false);
      }
    }
    *pushNewline() {
      const ch = this.buffer[this.pos];
      if (ch === `
`)
        return yield* this.pushCount(1);
      else if (ch === "\r" && this.charAt(1) === `
`)
        return yield* this.pushCount(2);
      else
        return 0;
    }
    *pushSpaces(allowTabs) {
      let i = this.pos - 1;
      let ch;
      do {
        ch = this.buffer[++i];
      } while (ch === " " || allowTabs && ch === "\t");
      const n = i - this.pos;
      if (n > 0) {
        yield this.buffer.substr(this.pos, n);
        this.pos = i;
      }
      return n;
    }
    *pushUntil(test) {
      let i = this.pos;
      let ch = this.buffer[i];
      while (!test(ch))
        ch = this.buffer[++i];
      return yield* this.pushToIndex(i, false);
    }
  }
  exports.Lexer = Lexer;
});

// node_modules/yaml/dist/parse/line-counter.js
var require_line_counter = __commonJS((exports) => {
  class LineCounter {
    constructor() {
      this.lineStarts = [];
      this.addNewLine = (offset) => this.lineStarts.push(offset);
      this.linePos = (offset) => {
        let low = 0;
        let high = this.lineStarts.length;
        while (low < high) {
          const mid = low + high >> 1;
          if (this.lineStarts[mid] < offset)
            low = mid + 1;
          else
            high = mid;
        }
        if (this.lineStarts[low] === offset)
          return { line: low + 1, col: 1 };
        if (low === 0)
          return { line: 0, col: offset };
        const start = this.lineStarts[low - 1];
        return { line: low, col: offset - start + 1 };
      };
    }
  }
  exports.LineCounter = LineCounter;
});

// node_modules/yaml/dist/parse/parser.js
var require_parser = __commonJS((exports) => {
  var node_process = __require("process");
  var cst = require_cst();
  var lexer = require_lexer();
  function includesToken(list, type) {
    for (let i = 0;i < list.length; ++i)
      if (list[i].type === type)
        return true;
    return false;
  }
  function findNonEmptyIndex(list) {
    for (let i = 0;i < list.length; ++i) {
      switch (list[i].type) {
        case "space":
        case "comment":
        case "newline":
          break;
        default:
          return i;
      }
    }
    return -1;
  }
  function isFlowToken(token) {
    switch (token?.type) {
      case "alias":
      case "scalar":
      case "single-quoted-scalar":
      case "double-quoted-scalar":
      case "flow-collection":
        return true;
      default:
        return false;
    }
  }
  function getPrevProps(parent) {
    switch (parent.type) {
      case "document":
        return parent.start;
      case "block-map": {
        const it = parent.items[parent.items.length - 1];
        return it.sep ?? it.start;
      }
      case "block-seq":
        return parent.items[parent.items.length - 1].start;
      default:
        return [];
    }
  }
  function getFirstKeyStartProps(prev) {
    if (prev.length === 0)
      return [];
    let i = prev.length;
    loop:
      while (--i >= 0) {
        switch (prev[i].type) {
          case "doc-start":
          case "explicit-key-ind":
          case "map-value-ind":
          case "seq-item-ind":
          case "newline":
            break loop;
        }
      }
    while (prev[++i]?.type === "space") {}
    return prev.splice(i, prev.length);
  }
  function arrayPushArray(target, source) {
    if (source.length < 1e5)
      Array.prototype.push.apply(target, source);
    else
      for (let i = 0;i < source.length; ++i)
        target.push(source[i]);
  }
  function fixFlowSeqItems(fc) {
    if (fc.start.type === "flow-seq-start") {
      for (const it of fc.items) {
        if (it.sep && !it.value && !includesToken(it.start, "explicit-key-ind") && !includesToken(it.sep, "map-value-ind")) {
          if (it.key)
            it.value = it.key;
          delete it.key;
          if (isFlowToken(it.value)) {
            if (it.value.end)
              arrayPushArray(it.value.end, it.sep);
            else
              it.value.end = it.sep;
          } else
            arrayPushArray(it.start, it.sep);
          delete it.sep;
        }
      }
    }
  }

  class Parser {
    constructor(onNewLine) {
      this.atNewLine = true;
      this.atScalar = false;
      this.indent = 0;
      this.offset = 0;
      this.onKeyLine = false;
      this.stack = [];
      this.source = "";
      this.type = "";
      this.lexer = new lexer.Lexer;
      this.onNewLine = onNewLine;
    }
    *parse(source, incomplete = false) {
      if (this.onNewLine && this.offset === 0)
        this.onNewLine(0);
      for (const lexeme of this.lexer.lex(source, incomplete))
        yield* this.next(lexeme);
      if (!incomplete)
        yield* this.end();
    }
    *next(source) {
      this.source = source;
      if (node_process.env.LOG_TOKENS)
        console.log("|", cst.prettyToken(source));
      if (this.atScalar) {
        this.atScalar = false;
        yield* this.step();
        this.offset += source.length;
        return;
      }
      const type = cst.tokenType(source);
      if (!type) {
        const message = `Not a YAML token: ${source}`;
        yield* this.pop({ type: "error", offset: this.offset, message, source });
        this.offset += source.length;
      } else if (type === "scalar") {
        this.atNewLine = false;
        this.atScalar = true;
        this.type = "scalar";
      } else {
        this.type = type;
        yield* this.step();
        switch (type) {
          case "newline":
            this.atNewLine = true;
            this.indent = 0;
            if (this.onNewLine)
              this.onNewLine(this.offset + source.length);
            break;
          case "space":
            if (this.atNewLine && source[0] === " ")
              this.indent += source.length;
            break;
          case "explicit-key-ind":
          case "map-value-ind":
          case "seq-item-ind":
            if (this.atNewLine)
              this.indent += source.length;
            break;
          case "doc-mode":
          case "flow-error-end":
            return;
          default:
            this.atNewLine = false;
        }
        this.offset += source.length;
      }
    }
    *end() {
      while (this.stack.length > 0)
        yield* this.pop();
    }
    get sourceToken() {
      const st = {
        type: this.type,
        offset: this.offset,
        indent: this.indent,
        source: this.source
      };
      return st;
    }
    *step() {
      const top = this.peek(1);
      if (this.type === "doc-end" && top?.type !== "doc-end") {
        while (this.stack.length > 0)
          yield* this.pop();
        this.stack.push({
          type: "doc-end",
          offset: this.offset,
          source: this.source
        });
        return;
      }
      if (!top)
        return yield* this.stream();
      switch (top.type) {
        case "document":
          return yield* this.document(top);
        case "alias":
        case "scalar":
        case "single-quoted-scalar":
        case "double-quoted-scalar":
          return yield* this.scalar(top);
        case "block-scalar":
          return yield* this.blockScalar(top);
        case "block-map":
          return yield* this.blockMap(top);
        case "block-seq":
          return yield* this.blockSequence(top);
        case "flow-collection":
          return yield* this.flowCollection(top);
        case "doc-end":
          return yield* this.documentEnd(top);
      }
      yield* this.pop();
    }
    peek(n) {
      return this.stack[this.stack.length - n];
    }
    *pop(error) {
      const token = error ?? this.stack.pop();
      if (!token) {
        const message = "Tried to pop an empty stack";
        yield { type: "error", offset: this.offset, source: "", message };
      } else if (this.stack.length === 0) {
        yield token;
      } else {
        const top = this.peek(1);
        if (token.type === "block-scalar") {
          token.indent = "indent" in top ? top.indent : 0;
        } else if (token.type === "flow-collection" && top.type === "document") {
          token.indent = 0;
        }
        if (token.type === "flow-collection")
          fixFlowSeqItems(token);
        switch (top.type) {
          case "document":
            top.value = token;
            break;
          case "block-scalar":
            top.props.push(token);
            break;
          case "block-map": {
            const it = top.items[top.items.length - 1];
            if (it.value) {
              top.items.push({ start: [], key: token, sep: [] });
              this.onKeyLine = true;
              return;
            } else if (it.sep) {
              it.value = token;
            } else {
              Object.assign(it, { key: token, sep: [] });
              this.onKeyLine = !it.explicitKey;
              return;
            }
            break;
          }
          case "block-seq": {
            const it = top.items[top.items.length - 1];
            if (it.value)
              top.items.push({ start: [], value: token });
            else
              it.value = token;
            break;
          }
          case "flow-collection": {
            const it = top.items[top.items.length - 1];
            if (!it || it.value)
              top.items.push({ start: [], key: token, sep: [] });
            else if (it.sep)
              it.value = token;
            else
              Object.assign(it, { key: token, sep: [] });
            return;
          }
          default:
            yield* this.pop();
            yield* this.pop(token);
        }
        if ((top.type === "document" || top.type === "block-map" || top.type === "block-seq") && (token.type === "block-map" || token.type === "block-seq")) {
          const last = token.items[token.items.length - 1];
          if (last && !last.sep && !last.value && last.start.length > 0 && findNonEmptyIndex(last.start) === -1 && (token.indent === 0 || last.start.every((st) => st.type !== "comment" || st.indent < token.indent))) {
            if (top.type === "document")
              top.end = last.start;
            else
              top.items.push({ start: last.start });
            token.items.splice(-1, 1);
          }
        }
      }
    }
    *stream() {
      switch (this.type) {
        case "directive-line":
          yield { type: "directive", offset: this.offset, source: this.source };
          return;
        case "byte-order-mark":
        case "space":
        case "comment":
        case "newline":
          yield this.sourceToken;
          return;
        case "doc-mode":
        case "doc-start": {
          const doc = {
            type: "document",
            offset: this.offset,
            start: []
          };
          if (this.type === "doc-start")
            doc.start.push(this.sourceToken);
          this.stack.push(doc);
          return;
        }
      }
      yield {
        type: "error",
        offset: this.offset,
        message: `Unexpected ${this.type} token in YAML stream`,
        source: this.source
      };
    }
    *document(doc) {
      if (doc.value)
        return yield* this.lineEnd(doc);
      switch (this.type) {
        case "doc-start": {
          if (findNonEmptyIndex(doc.start) !== -1) {
            yield* this.pop();
            yield* this.step();
          } else
            doc.start.push(this.sourceToken);
          return;
        }
        case "anchor":
        case "tag":
        case "space":
        case "comment":
        case "newline":
          doc.start.push(this.sourceToken);
          return;
      }
      const bv = this.startBlockValue(doc);
      if (bv)
        this.stack.push(bv);
      else {
        yield {
          type: "error",
          offset: this.offset,
          message: `Unexpected ${this.type} token in YAML document`,
          source: this.source
        };
      }
    }
    *scalar(scalar) {
      if (this.type === "map-value-ind") {
        const prev = getPrevProps(this.peek(2));
        const start = getFirstKeyStartProps(prev);
        let sep;
        if (scalar.end) {
          sep = scalar.end;
          sep.push(this.sourceToken);
          delete scalar.end;
        } else
          sep = [this.sourceToken];
        const map = {
          type: "block-map",
          offset: scalar.offset,
          indent: scalar.indent,
          items: [{ start, key: scalar, sep }]
        };
        this.onKeyLine = true;
        this.stack[this.stack.length - 1] = map;
      } else
        yield* this.lineEnd(scalar);
    }
    *blockScalar(scalar) {
      switch (this.type) {
        case "space":
        case "comment":
        case "newline":
          scalar.props.push(this.sourceToken);
          return;
        case "scalar":
          scalar.source = this.source;
          this.atNewLine = true;
          this.indent = 0;
          if (this.onNewLine) {
            let nl = this.source.indexOf(`
`) + 1;
            while (nl !== 0) {
              this.onNewLine(this.offset + nl);
              nl = this.source.indexOf(`
`, nl) + 1;
            }
          }
          yield* this.pop();
          break;
        default:
          yield* this.pop();
          yield* this.step();
      }
    }
    *blockMap(map) {
      const it = map.items[map.items.length - 1];
      switch (this.type) {
        case "newline":
          this.onKeyLine = false;
          if (it.value) {
            const end = "end" in it.value ? it.value.end : undefined;
            const last = Array.isArray(end) ? end[end.length - 1] : undefined;
            if (last?.type === "comment")
              end?.push(this.sourceToken);
            else
              map.items.push({ start: [this.sourceToken] });
          } else if (it.sep) {
            it.sep.push(this.sourceToken);
          } else {
            it.start.push(this.sourceToken);
          }
          return;
        case "space":
        case "comment":
          if (it.value) {
            map.items.push({ start: [this.sourceToken] });
          } else if (it.sep) {
            it.sep.push(this.sourceToken);
          } else {
            if (this.atIndentedComment(it.start, map.indent)) {
              const prev = map.items[map.items.length - 2];
              const end = prev?.value?.end;
              if (Array.isArray(end)) {
                arrayPushArray(end, it.start);
                end.push(this.sourceToken);
                map.items.pop();
                return;
              }
            }
            it.start.push(this.sourceToken);
          }
          return;
      }
      if (this.indent >= map.indent) {
        const atMapIndent = !this.onKeyLine && this.indent === map.indent;
        const atNextItem = atMapIndent && (it.sep || it.explicitKey) && this.type !== "seq-item-ind";
        let start = [];
        if (atNextItem && it.sep && !it.value) {
          const nl = [];
          for (let i = 0;i < it.sep.length; ++i) {
            const st = it.sep[i];
            switch (st.type) {
              case "newline":
                nl.push(i);
                break;
              case "space":
                break;
              case "comment":
                if (st.indent > map.indent)
                  nl.length = 0;
                break;
              default:
                nl.length = 0;
            }
          }
          if (nl.length >= 2)
            start = it.sep.splice(nl[1]);
        }
        switch (this.type) {
          case "anchor":
          case "tag":
            if (atNextItem || it.value) {
              start.push(this.sourceToken);
              map.items.push({ start });
              this.onKeyLine = true;
            } else if (it.sep) {
              it.sep.push(this.sourceToken);
            } else {
              it.start.push(this.sourceToken);
            }
            return;
          case "explicit-key-ind":
            if (!it.sep && !it.explicitKey) {
              it.start.push(this.sourceToken);
              it.explicitKey = true;
            } else if (atNextItem || it.value) {
              start.push(this.sourceToken);
              map.items.push({ start, explicitKey: true });
            } else {
              this.stack.push({
                type: "block-map",
                offset: this.offset,
                indent: this.indent,
                items: [{ start: [this.sourceToken], explicitKey: true }]
              });
            }
            this.onKeyLine = true;
            return;
          case "map-value-ind":
            if (it.explicitKey) {
              if (!it.sep) {
                if (includesToken(it.start, "newline")) {
                  Object.assign(it, { key: null, sep: [this.sourceToken] });
                } else {
                  const start2 = getFirstKeyStartProps(it.start);
                  this.stack.push({
                    type: "block-map",
                    offset: this.offset,
                    indent: this.indent,
                    items: [{ start: start2, key: null, sep: [this.sourceToken] }]
                  });
                }
              } else if (it.value) {
                map.items.push({ start: [], key: null, sep: [this.sourceToken] });
              } else if (includesToken(it.sep, "map-value-ind")) {
                this.stack.push({
                  type: "block-map",
                  offset: this.offset,
                  indent: this.indent,
                  items: [{ start, key: null, sep: [this.sourceToken] }]
                });
              } else if (isFlowToken(it.key) && !includesToken(it.sep, "newline")) {
                const start2 = getFirstKeyStartProps(it.start);
                const key = it.key;
                const sep = it.sep;
                sep.push(this.sourceToken);
                delete it.key;
                delete it.sep;
                this.stack.push({
                  type: "block-map",
                  offset: this.offset,
                  indent: this.indent,
                  items: [{ start: start2, key, sep }]
                });
              } else if (start.length > 0) {
                it.sep = it.sep.concat(start, this.sourceToken);
              } else {
                it.sep.push(this.sourceToken);
              }
            } else {
              if (!it.sep) {
                Object.assign(it, { key: null, sep: [this.sourceToken] });
              } else if (it.value || atNextItem) {
                map.items.push({ start, key: null, sep: [this.sourceToken] });
              } else if (includesToken(it.sep, "map-value-ind")) {
                this.stack.push({
                  type: "block-map",
                  offset: this.offset,
                  indent: this.indent,
                  items: [{ start: [], key: null, sep: [this.sourceToken] }]
                });
              } else {
                it.sep.push(this.sourceToken);
              }
            }
            this.onKeyLine = true;
            return;
          case "alias":
          case "scalar":
          case "single-quoted-scalar":
          case "double-quoted-scalar": {
            const fs = this.flowScalar(this.type);
            if (atNextItem || it.value) {
              map.items.push({ start, key: fs, sep: [] });
              this.onKeyLine = true;
            } else if (it.sep) {
              this.stack.push(fs);
            } else {
              Object.assign(it, { key: fs, sep: [] });
              this.onKeyLine = true;
            }
            return;
          }
          default: {
            const bv = this.startBlockValue(map);
            if (bv) {
              if (bv.type === "block-seq") {
                if (!it.explicitKey && it.sep && !includesToken(it.sep, "newline")) {
                  yield* this.pop({
                    type: "error",
                    offset: this.offset,
                    message: "Unexpected block-seq-ind on same line with key",
                    source: this.source
                  });
                  return;
                }
              } else if (atMapIndent) {
                map.items.push({ start });
              }
              this.stack.push(bv);
              return;
            }
          }
        }
      }
      yield* this.pop();
      yield* this.step();
    }
    *blockSequence(seq) {
      const it = seq.items[seq.items.length - 1];
      switch (this.type) {
        case "newline":
          if (it.value) {
            const end = "end" in it.value ? it.value.end : undefined;
            const last = Array.isArray(end) ? end[end.length - 1] : undefined;
            if (last?.type === "comment")
              end?.push(this.sourceToken);
            else
              seq.items.push({ start: [this.sourceToken] });
          } else
            it.start.push(this.sourceToken);
          return;
        case "space":
        case "comment":
          if (it.value)
            seq.items.push({ start: [this.sourceToken] });
          else {
            if (this.atIndentedComment(it.start, seq.indent)) {
              const prev = seq.items[seq.items.length - 2];
              const end = prev?.value?.end;
              if (Array.isArray(end)) {
                arrayPushArray(end, it.start);
                end.push(this.sourceToken);
                seq.items.pop();
                return;
              }
            }
            it.start.push(this.sourceToken);
          }
          return;
        case "anchor":
        case "tag":
          if (it.value || this.indent <= seq.indent)
            break;
          it.start.push(this.sourceToken);
          return;
        case "seq-item-ind":
          if (this.indent !== seq.indent)
            break;
          if (it.value || includesToken(it.start, "seq-item-ind"))
            seq.items.push({ start: [this.sourceToken] });
          else
            it.start.push(this.sourceToken);
          return;
      }
      if (this.indent > seq.indent) {
        const bv = this.startBlockValue(seq);
        if (bv) {
          this.stack.push(bv);
          return;
        }
      }
      yield* this.pop();
      yield* this.step();
    }
    *flowCollection(fc) {
      const it = fc.items[fc.items.length - 1];
      if (this.type === "flow-error-end") {
        let top;
        do {
          yield* this.pop();
          top = this.peek(1);
        } while (top?.type === "flow-collection");
      } else if (fc.end.length === 0) {
        switch (this.type) {
          case "comma":
          case "explicit-key-ind":
            if (!it || it.sep)
              fc.items.push({ start: [this.sourceToken] });
            else
              it.start.push(this.sourceToken);
            return;
          case "map-value-ind":
            if (!it || it.value)
              fc.items.push({ start: [], key: null, sep: [this.sourceToken] });
            else if (it.sep)
              it.sep.push(this.sourceToken);
            else
              Object.assign(it, { key: null, sep: [this.sourceToken] });
            return;
          case "space":
          case "comment":
          case "newline":
          case "anchor":
          case "tag":
            if (!it || it.value)
              fc.items.push({ start: [this.sourceToken] });
            else if (it.sep)
              it.sep.push(this.sourceToken);
            else
              it.start.push(this.sourceToken);
            return;
          case "alias":
          case "scalar":
          case "single-quoted-scalar":
          case "double-quoted-scalar": {
            const fs = this.flowScalar(this.type);
            if (!it || it.value)
              fc.items.push({ start: [], key: fs, sep: [] });
            else if (it.sep)
              this.stack.push(fs);
            else
              Object.assign(it, { key: fs, sep: [] });
            return;
          }
          case "flow-map-end":
          case "flow-seq-end":
            fc.end.push(this.sourceToken);
            return;
        }
        const bv = this.startBlockValue(fc);
        if (bv)
          this.stack.push(bv);
        else {
          yield* this.pop();
          yield* this.step();
        }
      } else {
        const parent = this.peek(2);
        if (parent.type === "block-map" && (this.type === "map-value-ind" && parent.indent === fc.indent || this.type === "newline" && !parent.items[parent.items.length - 1].sep)) {
          yield* this.pop();
          yield* this.step();
        } else if (this.type === "map-value-ind" && parent.type !== "flow-collection") {
          const prev = getPrevProps(parent);
          const start = getFirstKeyStartProps(prev);
          fixFlowSeqItems(fc);
          const sep = fc.end.splice(1, fc.end.length);
          sep.push(this.sourceToken);
          const map = {
            type: "block-map",
            offset: fc.offset,
            indent: fc.indent,
            items: [{ start, key: fc, sep }]
          };
          this.onKeyLine = true;
          this.stack[this.stack.length - 1] = map;
        } else {
          yield* this.lineEnd(fc);
        }
      }
    }
    flowScalar(type) {
      if (this.onNewLine) {
        let nl = this.source.indexOf(`
`) + 1;
        while (nl !== 0) {
          this.onNewLine(this.offset + nl);
          nl = this.source.indexOf(`
`, nl) + 1;
        }
      }
      return {
        type,
        offset: this.offset,
        indent: this.indent,
        source: this.source
      };
    }
    startBlockValue(parent) {
      switch (this.type) {
        case "alias":
        case "scalar":
        case "single-quoted-scalar":
        case "double-quoted-scalar":
          return this.flowScalar(this.type);
        case "block-scalar-header":
          return {
            type: "block-scalar",
            offset: this.offset,
            indent: this.indent,
            props: [this.sourceToken],
            source: ""
          };
        case "flow-map-start":
        case "flow-seq-start":
          return {
            type: "flow-collection",
            offset: this.offset,
            indent: this.indent,
            start: this.sourceToken,
            items: [],
            end: []
          };
        case "seq-item-ind":
          return {
            type: "block-seq",
            offset: this.offset,
            indent: this.indent,
            items: [{ start: [this.sourceToken] }]
          };
        case "explicit-key-ind": {
          this.onKeyLine = true;
          const prev = getPrevProps(parent);
          const start = getFirstKeyStartProps(prev);
          start.push(this.sourceToken);
          return {
            type: "block-map",
            offset: this.offset,
            indent: this.indent,
            items: [{ start, explicitKey: true }]
          };
        }
        case "map-value-ind": {
          this.onKeyLine = true;
          const prev = getPrevProps(parent);
          const start = getFirstKeyStartProps(prev);
          return {
            type: "block-map",
            offset: this.offset,
            indent: this.indent,
            items: [{ start, key: null, sep: [this.sourceToken] }]
          };
        }
      }
      return null;
    }
    atIndentedComment(start, indent) {
      if (this.type !== "comment")
        return false;
      if (this.indent <= indent)
        return false;
      return start.every((st) => st.type === "newline" || st.type === "space");
    }
    *documentEnd(docEnd) {
      if (this.type !== "doc-mode") {
        if (docEnd.end)
          docEnd.end.push(this.sourceToken);
        else
          docEnd.end = [this.sourceToken];
        if (this.type === "newline")
          yield* this.pop();
      }
    }
    *lineEnd(token) {
      switch (this.type) {
        case "comma":
        case "doc-start":
        case "doc-end":
        case "flow-seq-end":
        case "flow-map-end":
        case "map-value-ind":
          yield* this.pop();
          yield* this.step();
          break;
        case "newline":
          this.onKeyLine = false;
        case "space":
        case "comment":
        default:
          if (token.end)
            token.end.push(this.sourceToken);
          else
            token.end = [this.sourceToken];
          if (this.type === "newline")
            yield* this.pop();
      }
    }
  }
  exports.Parser = Parser;
});

// node_modules/yaml/dist/public-api.js
var require_public_api = __commonJS((exports) => {
  var composer = require_composer();
  var Document = require_Document();
  var errors = require_errors();
  var log2 = require_log();
  var identity = require_identity();
  var lineCounter = require_line_counter();
  var parser = require_parser();
  function parseOptions(options) {
    const prettyErrors = options.prettyErrors !== false;
    const lineCounter$1 = options.lineCounter || prettyErrors && new lineCounter.LineCounter || null;
    return { lineCounter: lineCounter$1, prettyErrors };
  }
  function parseAllDocuments(source, options = {}) {
    const { lineCounter: lineCounter2, prettyErrors } = parseOptions(options);
    const parser$1 = new parser.Parser(lineCounter2?.addNewLine);
    const composer$1 = new composer.Composer(options);
    const docs = Array.from(composer$1.compose(parser$1.parse(source)));
    if (prettyErrors && lineCounter2)
      for (const doc of docs) {
        doc.errors.forEach(errors.prettifyError(source, lineCounter2));
        doc.warnings.forEach(errors.prettifyError(source, lineCounter2));
      }
    if (docs.length > 0)
      return docs;
    return Object.assign([], { empty: true }, composer$1.streamInfo());
  }
  function parseDocument(source, options = {}) {
    const { lineCounter: lineCounter2, prettyErrors } = parseOptions(options);
    const parser$1 = new parser.Parser(lineCounter2?.addNewLine);
    const composer$1 = new composer.Composer(options);
    let doc = null;
    for (const _doc of composer$1.compose(parser$1.parse(source), true, source.length)) {
      if (!doc)
        doc = _doc;
      else if (doc.options.logLevel !== "silent") {
        doc.errors.push(new errors.YAMLParseError(_doc.range.slice(0, 2), "MULTIPLE_DOCS", "Source contains multiple documents; please use YAML.parseAllDocuments()"));
        break;
      }
    }
    if (prettyErrors && lineCounter2) {
      doc.errors.forEach(errors.prettifyError(source, lineCounter2));
      doc.warnings.forEach(errors.prettifyError(source, lineCounter2));
    }
    return doc;
  }
  function parse(src, reviver, options) {
    let _reviver = undefined;
    if (typeof reviver === "function") {
      _reviver = reviver;
    } else if (options === undefined && reviver && typeof reviver === "object") {
      options = reviver;
    }
    const doc = parseDocument(src, options);
    if (!doc)
      return null;
    doc.warnings.forEach((warning) => log2.warn(doc.options.logLevel, warning));
    if (doc.errors.length > 0) {
      if (doc.options.logLevel !== "silent")
        throw doc.errors[0];
      else
        doc.errors = [];
    }
    return doc.toJS(Object.assign({ reviver: _reviver }, options));
  }
  function stringify(value, replacer, options) {
    let _replacer = null;
    if (typeof replacer === "function" || Array.isArray(replacer)) {
      _replacer = replacer;
    } else if (options === undefined && replacer) {
      options = replacer;
    }
    if (typeof options === "string")
      options = options.length;
    if (typeof options === "number") {
      const indent = Math.round(options);
      options = indent < 1 ? undefined : indent > 8 ? { indent: 8 } : { indent };
    }
    if (value === undefined) {
      const { keepUndefined } = options ?? replacer ?? {};
      if (!keepUndefined)
        return;
    }
    if (identity.isDocument(value) && !_replacer)
      return value.toString(options);
    return new Document.Document(value, _replacer, options).toString(options);
  }
  exports.parse = parse;
  exports.parseAllDocuments = parseAllDocuments;
  exports.parseDocument = parseDocument;
  exports.stringify = stringify;
});

// node_modules/yaml/dist/index.js
var exports_dist = {};
__export(exports_dist, {
  visitAsync: () => $visitAsync,
  visit: () => $visit,
  stringify: () => $stringify,
  parseDocument: () => $parseDocument,
  parseAllDocuments: () => $parseAllDocuments,
  parse: () => $parse,
  isSeq: () => $isSeq,
  isScalar: () => $isScalar,
  isPair: () => $isPair,
  isNode: () => $isNode,
  isMap: () => $isMap,
  isDocument: () => $isDocument,
  isCollection: () => $isCollection,
  isAlias: () => $isAlias,
  YAMLWarning: () => $YAMLWarning,
  YAMLSeq: () => $YAMLSeq,
  YAMLParseError: () => $YAMLParseError,
  YAMLMap: () => $YAMLMap,
  YAMLError: () => $YAMLError,
  Schema: () => $Schema,
  Scalar: () => $Scalar,
  Parser: () => $Parser,
  Pair: () => $Pair,
  LineCounter: () => $LineCounter,
  Lexer: () => $Lexer,
  Document: () => $Document,
  Composer: () => $Composer,
  CST: () => $CST,
  Alias: () => $Alias
});
var composer, Document, Schema, errors, Alias, identity, Pair, Scalar, YAMLMap, YAMLSeq, cst, lexer, lineCounter, parser, publicApi, visit, $Composer, $Document, $Schema, $YAMLError, $YAMLParseError, $YAMLWarning, $Alias, $isAlias, $isCollection, $isDocument, $isMap, $isNode, $isPair, $isScalar, $isSeq, $Pair, $Scalar, $YAMLMap, $YAMLSeq, $CST, $Lexer, $LineCounter, $Parser, $parse, $parseAllDocuments, $parseDocument, $stringify, $visit, $visitAsync;
var init_dist = __esm(() => {
  composer = require_composer();
  Document = require_Document();
  Schema = require_Schema();
  errors = require_errors();
  Alias = require_Alias();
  identity = require_identity();
  Pair = require_Pair();
  Scalar = require_Scalar();
  YAMLMap = require_YAMLMap();
  YAMLSeq = require_YAMLSeq();
  cst = require_cst();
  lexer = require_lexer();
  lineCounter = require_line_counter();
  parser = require_parser();
  publicApi = require_public_api();
  visit = require_visit();
  $Composer = composer.Composer;
  $Document = Document.Document;
  $Schema = Schema.Schema;
  $YAMLError = errors.YAMLError;
  $YAMLParseError = errors.YAMLParseError;
  $YAMLWarning = errors.YAMLWarning;
  $Alias = Alias.Alias;
  $isAlias = identity.isAlias;
  $isCollection = identity.isCollection;
  $isDocument = identity.isDocument;
  $isMap = identity.isMap;
  $isNode = identity.isNode;
  $isPair = identity.isPair;
  $isScalar = identity.isScalar;
  $isSeq = identity.isSeq;
  $Pair = Pair.Pair;
  $Scalar = Scalar.Scalar;
  $YAMLMap = YAMLMap.YAMLMap;
  $YAMLSeq = YAMLSeq.YAMLSeq;
  $CST = cst;
  $Lexer = lexer.Lexer;
  $LineCounter = lineCounter.LineCounter;
  $Parser = parser.Parser;
  $parse = publicApi.parse;
  $parseAllDocuments = publicApi.parseAllDocuments;
  $parseDocument = publicApi.parseDocument;
  $stringify = publicApi.stringify;
  $visit = visit.visit;
  $visitAsync = visit.visitAsync;
});

// node_modules/dotenv/package.json
var require_package = __commonJS((exports, module) => {
  module.exports = {
    name: "dotenv",
    version: "16.6.1",
    description: "Loads environment variables from .env file",
    main: "lib/main.js",
    types: "lib/main.d.ts",
    exports: {
      ".": {
        types: "./lib/main.d.ts",
        require: "./lib/main.js",
        default: "./lib/main.js"
      },
      "./config": "./config.js",
      "./config.js": "./config.js",
      "./lib/env-options": "./lib/env-options.js",
      "./lib/env-options.js": "./lib/env-options.js",
      "./lib/cli-options": "./lib/cli-options.js",
      "./lib/cli-options.js": "./lib/cli-options.js",
      "./package.json": "./package.json"
    },
    scripts: {
      "dts-check": "tsc --project tests/types/tsconfig.json",
      lint: "standard",
      pretest: "npm run lint && npm run dts-check",
      test: "tap run --allow-empty-coverage --disable-coverage --timeout=60000",
      "test:coverage": "tap run --show-full-coverage --timeout=60000 --coverage-report=text --coverage-report=lcov",
      prerelease: "npm test",
      release: "standard-version"
    },
    repository: {
      type: "git",
      url: "git://github.com/motdotla/dotenv.git"
    },
    homepage: "https://github.com/motdotla/dotenv#readme",
    funding: "https://dotenvx.com",
    keywords: [
      "dotenv",
      "env",
      ".env",
      "environment",
      "variables",
      "config",
      "settings"
    ],
    readmeFilename: "README.md",
    license: "BSD-2-Clause",
    devDependencies: {
      "@types/node": "^18.11.3",
      decache: "^4.6.2",
      sinon: "^14.0.1",
      standard: "^17.0.0",
      "standard-version": "^9.5.0",
      tap: "^19.2.0",
      typescript: "^4.8.4"
    },
    engines: {
      node: ">=12"
    },
    browser: {
      fs: false
    }
  };
});

// node_modules/dotenv/lib/main.js
var require_main = __commonJS((exports, module) => {
  var fs = __require("fs");
  var path = __require("path");
  var os = __require("os");
  var crypto = __require("crypto");
  var packageJson = require_package();
  var version = packageJson.version;
  var LINE = /(?:^|^)\s*(?:export\s+)?([\w.-]+)(?:\s*=\s*?|:\s+?)(\s*'(?:\\'|[^'])*'|\s*"(?:\\"|[^"])*"|\s*`(?:\\`|[^`])*`|[^#\r\n]+)?\s*(?:#.*)?(?:$|$)/mg;
  function parse(src) {
    const obj = {};
    let lines = src.toString();
    lines = lines.replace(/\r\n?/mg, `
`);
    let match;
    while ((match = LINE.exec(lines)) != null) {
      const key = match[1];
      let value = match[2] || "";
      value = value.trim();
      const maybeQuote = value[0];
      value = value.replace(/^(['"`])([\s\S]*)\1$/mg, "$2");
      if (maybeQuote === '"') {
        value = value.replace(/\\n/g, `
`);
        value = value.replace(/\\r/g, "\r");
      }
      obj[key] = value;
    }
    return obj;
  }
  function _parseVault(options) {
    options = options || {};
    const vaultPath = _vaultPath(options);
    options.path = vaultPath;
    const result = DotenvModule.configDotenv(options);
    if (!result.parsed) {
      const err = new Error(`MISSING_DATA: Cannot parse ${vaultPath} for an unknown reason`);
      err.code = "MISSING_DATA";
      throw err;
    }
    const keys = _dotenvKey(options).split(",");
    const length = keys.length;
    let decrypted;
    for (let i = 0;i < length; i++) {
      try {
        const key = keys[i].trim();
        const attrs = _instructions(result, key);
        decrypted = DotenvModule.decrypt(attrs.ciphertext, attrs.key);
        break;
      } catch (error) {
        if (i + 1 >= length) {
          throw error;
        }
      }
    }
    return DotenvModule.parse(decrypted);
  }
  function _warn(message) {
    console.log(`[dotenv@${version}][WARN] ${message}`);
  }
  function _debug(message) {
    console.log(`[dotenv@${version}][DEBUG] ${message}`);
  }
  function _log(message) {
    console.log(`[dotenv@${version}] ${message}`);
  }
  function _dotenvKey(options) {
    if (options && options.DOTENV_KEY && options.DOTENV_KEY.length > 0) {
      return options.DOTENV_KEY;
    }
    if (process.env.DOTENV_KEY && process.env.DOTENV_KEY.length > 0) {
      return process.env.DOTENV_KEY;
    }
    return "";
  }
  function _instructions(result, dotenvKey) {
    let uri;
    try {
      uri = new URL(dotenvKey);
    } catch (error) {
      if (error.code === "ERR_INVALID_URL") {
        const err = new Error("INVALID_DOTENV_KEY: Wrong format. Must be in valid uri format like dotenv://:key_1234@dotenvx.com/vault/.env.vault?environment=development");
        err.code = "INVALID_DOTENV_KEY";
        throw err;
      }
      throw error;
    }
    const key = uri.password;
    if (!key) {
      const err = new Error("INVALID_DOTENV_KEY: Missing key part");
      err.code = "INVALID_DOTENV_KEY";
      throw err;
    }
    const environment = uri.searchParams.get("environment");
    if (!environment) {
      const err = new Error("INVALID_DOTENV_KEY: Missing environment part");
      err.code = "INVALID_DOTENV_KEY";
      throw err;
    }
    const environmentKey = `DOTENV_VAULT_${environment.toUpperCase()}`;
    const ciphertext = result.parsed[environmentKey];
    if (!ciphertext) {
      const err = new Error(`NOT_FOUND_DOTENV_ENVIRONMENT: Cannot locate environment ${environmentKey} in your .env.vault file.`);
      err.code = "NOT_FOUND_DOTENV_ENVIRONMENT";
      throw err;
    }
    return { ciphertext, key };
  }
  function _vaultPath(options) {
    let possibleVaultPath = null;
    if (options && options.path && options.path.length > 0) {
      if (Array.isArray(options.path)) {
        for (const filepath of options.path) {
          if (fs.existsSync(filepath)) {
            possibleVaultPath = filepath.endsWith(".vault") ? filepath : `${filepath}.vault`;
          }
        }
      } else {
        possibleVaultPath = options.path.endsWith(".vault") ? options.path : `${options.path}.vault`;
      }
    } else {
      possibleVaultPath = path.resolve(process.cwd(), ".env.vault");
    }
    if (fs.existsSync(possibleVaultPath)) {
      return possibleVaultPath;
    }
    return null;
  }
  function _resolveHome(envPath) {
    return envPath[0] === "~" ? path.join(os.homedir(), envPath.slice(1)) : envPath;
  }
  function _configVault(options) {
    const debug = Boolean(options && options.debug);
    const quiet = options && "quiet" in options ? options.quiet : true;
    if (debug || !quiet) {
      _log("Loading env from encrypted .env.vault");
    }
    const parsed = DotenvModule._parseVault(options);
    let processEnv = process.env;
    if (options && options.processEnv != null) {
      processEnv = options.processEnv;
    }
    DotenvModule.populate(processEnv, parsed, options);
    return { parsed };
  }
  function configDotenv(options) {
    const dotenvPath = path.resolve(process.cwd(), ".env");
    let encoding = "utf8";
    const debug = Boolean(options && options.debug);
    const quiet = options && "quiet" in options ? options.quiet : true;
    if (options && options.encoding) {
      encoding = options.encoding;
    } else {
      if (debug) {
        _debug("No encoding is specified. UTF-8 is used by default");
      }
    }
    let optionPaths = [dotenvPath];
    if (options && options.path) {
      if (!Array.isArray(options.path)) {
        optionPaths = [_resolveHome(options.path)];
      } else {
        optionPaths = [];
        for (const filepath of options.path) {
          optionPaths.push(_resolveHome(filepath));
        }
      }
    }
    let lastError;
    const parsedAll = {};
    for (const path2 of optionPaths) {
      try {
        const parsed = DotenvModule.parse(fs.readFileSync(path2, { encoding }));
        DotenvModule.populate(parsedAll, parsed, options);
      } catch (e) {
        if (debug) {
          _debug(`Failed to load ${path2} ${e.message}`);
        }
        lastError = e;
      }
    }
    let processEnv = process.env;
    if (options && options.processEnv != null) {
      processEnv = options.processEnv;
    }
    DotenvModule.populate(processEnv, parsedAll, options);
    if (debug || !quiet) {
      const keysCount = Object.keys(parsedAll).length;
      const shortPaths = [];
      for (const filePath of optionPaths) {
        try {
          const relative = path.relative(process.cwd(), filePath);
          shortPaths.push(relative);
        } catch (e) {
          if (debug) {
            _debug(`Failed to load ${filePath} ${e.message}`);
          }
          lastError = e;
        }
      }
      _log(`injecting env (${keysCount}) from ${shortPaths.join(",")}`);
    }
    if (lastError) {
      return { parsed: parsedAll, error: lastError };
    } else {
      return { parsed: parsedAll };
    }
  }
  function config(options) {
    if (_dotenvKey(options).length === 0) {
      return DotenvModule.configDotenv(options);
    }
    const vaultPath = _vaultPath(options);
    if (!vaultPath) {
      _warn(`You set DOTENV_KEY but you are missing a .env.vault file at ${vaultPath}. Did you forget to build it?`);
      return DotenvModule.configDotenv(options);
    }
    return DotenvModule._configVault(options);
  }
  function decrypt(encrypted, keyStr) {
    const key = Buffer.from(keyStr.slice(-64), "hex");
    let ciphertext = Buffer.from(encrypted, "base64");
    const nonce = ciphertext.subarray(0, 12);
    const authTag = ciphertext.subarray(-16);
    ciphertext = ciphertext.subarray(12, -16);
    try {
      const aesgcm = crypto.createDecipheriv("aes-256-gcm", key, nonce);
      aesgcm.setAuthTag(authTag);
      return `${aesgcm.update(ciphertext)}${aesgcm.final()}`;
    } catch (error) {
      const isRange = error instanceof RangeError;
      const invalidKeyLength = error.message === "Invalid key length";
      const decryptionFailed = error.message === "Unsupported state or unable to authenticate data";
      if (isRange || invalidKeyLength) {
        const err = new Error("INVALID_DOTENV_KEY: It must be 64 characters long (or more)");
        err.code = "INVALID_DOTENV_KEY";
        throw err;
      } else if (decryptionFailed) {
        const err = new Error("DECRYPTION_FAILED: Please check your DOTENV_KEY");
        err.code = "DECRYPTION_FAILED";
        throw err;
      } else {
        throw error;
      }
    }
  }
  function populate(processEnv, parsed, options = {}) {
    const debug = Boolean(options && options.debug);
    const override = Boolean(options && options.override);
    if (typeof parsed !== "object") {
      const err = new Error("OBJECT_REQUIRED: Please check the processEnv argument being passed to populate");
      err.code = "OBJECT_REQUIRED";
      throw err;
    }
    for (const key of Object.keys(parsed)) {
      if (Object.prototype.hasOwnProperty.call(processEnv, key)) {
        if (override === true) {
          processEnv[key] = parsed[key];
        }
        if (debug) {
          if (override === true) {
            _debug(`"${key}" is already defined and WAS overwritten`);
          } else {
            _debug(`"${key}" is already defined and was NOT overwritten`);
          }
        }
      } else {
        processEnv[key] = parsed[key];
      }
    }
  }
  var DotenvModule = {
    configDotenv,
    _configVault,
    _parseVault,
    config,
    decrypt,
    parse,
    populate
  };
  exports.configDotenv = DotenvModule.configDotenv;
  exports._configVault = DotenvModule._configVault;
  exports._parseVault = DotenvModule._parseVault;
  exports.config = DotenvModule.config;
  exports.decrypt = DotenvModule.decrypt;
  exports.parse = DotenvModule.parse;
  exports.populate = DotenvModule.populate;
  module.exports = DotenvModule;
});

// node_modules/cliui/build/lib/index.js
class UI {
  constructor(opts) {
    var _a;
    this.width = opts.width;
    this.wrap = (_a = opts.wrap) !== null && _a !== undefined ? _a : true;
    this.rows = [];
  }
  span(...args) {
    const cols = this.div(...args);
    cols.span = true;
  }
  resetOutput() {
    this.rows = [];
  }
  div(...args) {
    if (args.length === 0) {
      this.div("");
    }
    if (this.wrap && this.shouldApplyLayoutDSL(...args) && typeof args[0] === "string") {
      return this.applyLayoutDSL(args[0]);
    }
    const cols = args.map((arg) => {
      if (typeof arg === "string") {
        return this.colFromString(arg);
      }
      return arg;
    });
    this.rows.push(cols);
    return cols;
  }
  shouldApplyLayoutDSL(...args) {
    return args.length === 1 && typeof args[0] === "string" && /[\t\n]/.test(args[0]);
  }
  applyLayoutDSL(str) {
    const rows = str.split(`
`).map((row) => row.split("\t"));
    let leftColumnWidth = 0;
    rows.forEach((columns) => {
      if (columns.length > 1 && mixin.stringWidth(columns[0]) > leftColumnWidth) {
        leftColumnWidth = Math.min(Math.floor(this.width * 0.5), mixin.stringWidth(columns[0]));
      }
    });
    rows.forEach((columns) => {
      this.div(...columns.map((r, i) => {
        return {
          text: r.trim(),
          padding: this.measurePadding(r),
          width: i === 0 && columns.length > 1 ? leftColumnWidth : undefined
        };
      }));
    });
    return this.rows[this.rows.length - 1];
  }
  colFromString(text) {
    return {
      text,
      padding: this.measurePadding(text)
    };
  }
  measurePadding(str) {
    const noAnsi = mixin.stripAnsi(str);
    return [0, noAnsi.match(/\s*$/)[0].length, 0, noAnsi.match(/^\s*/)[0].length];
  }
  toString() {
    const lines = [];
    this.rows.forEach((row) => {
      this.rowToString(row, lines);
    });
    return lines.filter((line) => !line.hidden).map((line) => line.text).join(`
`);
  }
  rowToString(row, lines) {
    this.rasterize(row).forEach((rrow, r) => {
      let str = "";
      rrow.forEach((col, c) => {
        const { width } = row[c];
        const wrapWidth = this.negatePadding(row[c]);
        let ts = col;
        if (wrapWidth > mixin.stringWidth(col)) {
          ts += " ".repeat(wrapWidth - mixin.stringWidth(col));
        }
        if (row[c].align && row[c].align !== "left" && this.wrap) {
          const fn = align[row[c].align];
          ts = fn(ts, wrapWidth);
          if (mixin.stringWidth(ts) < wrapWidth) {
            ts += " ".repeat((width || 0) - mixin.stringWidth(ts) - 1);
          }
        }
        const padding = row[c].padding || [0, 0, 0, 0];
        if (padding[left]) {
          str += " ".repeat(padding[left]);
        }
        str += addBorder(row[c], ts, "| ");
        str += ts;
        str += addBorder(row[c], ts, " |");
        if (padding[right]) {
          str += " ".repeat(padding[right]);
        }
        if (r === 0 && lines.length > 0) {
          str = this.renderInline(str, lines[lines.length - 1]);
        }
      });
      lines.push({
        text: str.replace(/ +$/, ""),
        span: row.span
      });
    });
    return lines;
  }
  renderInline(source, previousLine) {
    const match = source.match(/^ */);
    const leadingWhitespace = match ? match[0].length : 0;
    const target = previousLine.text;
    const targetTextWidth = mixin.stringWidth(target.trimRight());
    if (!previousLine.span) {
      return source;
    }
    if (!this.wrap) {
      previousLine.hidden = true;
      return target + source;
    }
    if (leadingWhitespace < targetTextWidth) {
      return source;
    }
    previousLine.hidden = true;
    return target.trimRight() + " ".repeat(leadingWhitespace - targetTextWidth) + source.trimLeft();
  }
  rasterize(row) {
    const rrows = [];
    const widths = this.columnWidths(row);
    let wrapped;
    row.forEach((col, c) => {
      col.width = widths[c];
      if (this.wrap) {
        wrapped = mixin.wrap(col.text, this.negatePadding(col), { hard: true }).split(`
`);
      } else {
        wrapped = col.text.split(`
`);
      }
      if (col.border) {
        wrapped.unshift("." + "-".repeat(this.negatePadding(col) + 2) + ".");
        wrapped.push("'" + "-".repeat(this.negatePadding(col) + 2) + "'");
      }
      if (col.padding) {
        wrapped.unshift(...new Array(col.padding[top] || 0).fill(""));
        wrapped.push(...new Array(col.padding[bottom] || 0).fill(""));
      }
      wrapped.forEach((str, r) => {
        if (!rrows[r]) {
          rrows.push([]);
        }
        const rrow = rrows[r];
        for (let i = 0;i < c; i++) {
          if (rrow[i] === undefined) {
            rrow.push("");
          }
        }
        rrow.push(str);
      });
    });
    return rrows;
  }
  negatePadding(col) {
    let wrapWidth = col.width || 0;
    if (col.padding) {
      wrapWidth -= (col.padding[left] || 0) + (col.padding[right] || 0);
    }
    if (col.border) {
      wrapWidth -= 4;
    }
    return wrapWidth;
  }
  columnWidths(row) {
    if (!this.wrap) {
      return row.map((col) => {
        return col.width || mixin.stringWidth(col.text);
      });
    }
    let unset = row.length;
    let remainingWidth = this.width;
    const widths = row.map((col) => {
      if (col.width) {
        unset--;
        remainingWidth -= col.width;
        return col.width;
      }
      return;
    });
    const unsetWidth = unset ? Math.floor(remainingWidth / unset) : 0;
    return widths.map((w, i) => {
      if (w === undefined) {
        return Math.max(unsetWidth, _minWidth(row[i]));
      }
      return w;
    });
  }
}
function addBorder(col, ts, style) {
  if (col.border) {
    if (/[.']-+[.']/.test(ts)) {
      return "";
    }
    if (ts.trim().length !== 0) {
      return style;
    }
    return "  ";
  }
  return "";
}
function _minWidth(col) {
  const padding = col.padding || [];
  const minWidth = 1 + (padding[left] || 0) + (padding[right] || 0);
  if (col.border) {
    return minWidth + 4;
  }
  return minWidth;
}
function getWindowWidth() {
  if (typeof process === "object" && process.stdout && process.stdout.columns) {
    return process.stdout.columns;
  }
  return 80;
}
function alignRight(str, width) {
  str = str.trim();
  const strWidth = mixin.stringWidth(str);
  if (strWidth < width) {
    return " ".repeat(width - strWidth) + str;
  }
  return str;
}
function alignCenter(str, width) {
  str = str.trim();
  const strWidth = mixin.stringWidth(str);
  if (strWidth >= width) {
    return str;
  }
  return " ".repeat(width - strWidth >> 1) + str;
}
function cliui(opts, _mixin) {
  mixin = _mixin;
  return new UI({
    width: (opts === null || opts === undefined ? undefined : opts.width) || getWindowWidth(),
    wrap: opts === null || opts === undefined ? undefined : opts.wrap
  });
}
var align, top = 0, right = 1, bottom = 2, left = 3, mixin;
var init_lib = __esm(() => {
  align = {
    right: alignRight,
    center: alignCenter
  };
});

// node_modules/cliui/build/lib/string-utils.js
function stripAnsi(str) {
  return str.replace(ansi, "");
}
function wrap(str, width) {
  const [start, end] = str.match(ansi) || ["", ""];
  str = stripAnsi(str);
  let wrapped = "";
  for (let i = 0;i < str.length; i++) {
    if (i !== 0 && i % width === 0) {
      wrapped += `
`;
    }
    wrapped += str.charAt(i);
  }
  if (start && end) {
    wrapped = `${start}${wrapped}${end}`;
  }
  return wrapped;
}
var ansi;
var init_string_utils = __esm(() => {
  ansi = new RegExp("\x1B(?:\\[(?:\\d+[ABCDEFGJKSTm]|\\d+;\\d+[Hfm]|" + "\\d+;\\d+;\\d+m|6n|s|u|\\?25[lh])|\\w)", "g");
});

// node_modules/cliui/index.mjs
function ui(opts) {
  return cliui(opts, {
    stringWidth: (str) => {
      return [...str].length;
    },
    stripAnsi,
    wrap
  });
}
var init_cliui = __esm(() => {
  init_lib();
  init_string_utils();
});

// node_modules/escalade/sync/index.mjs
import { dirname, resolve } from "path";
import { readdirSync, statSync } from "fs";
function sync_default(start, callback) {
  let dir = resolve(".", start);
  let tmp, stats = statSync(dir);
  if (!stats.isDirectory()) {
    dir = dirname(dir);
  }
  while (true) {
    tmp = callback(dir, readdirSync(dir));
    if (tmp)
      return resolve(dir, tmp);
    dir = dirname(tmp = dir);
    if (tmp === dir)
      break;
  }
}
var init_sync = () => {};

// node_modules/yargs-parser/build/lib/string-utils.js
function camelCase(str) {
  const isCamelCase = str !== str.toLowerCase() && str !== str.toUpperCase();
  if (!isCamelCase) {
    str = str.toLowerCase();
  }
  if (str.indexOf("-") === -1 && str.indexOf("_") === -1) {
    return str;
  } else {
    let camelcase = "";
    let nextChrUpper = false;
    const leadingHyphens = str.match(/^-+/);
    for (let i = leadingHyphens ? leadingHyphens[0].length : 0;i < str.length; i++) {
      let chr = str.charAt(i);
      if (nextChrUpper) {
        nextChrUpper = false;
        chr = chr.toUpperCase();
      }
      if (i !== 0 && (chr === "-" || chr === "_")) {
        nextChrUpper = true;
      } else if (chr !== "-" && chr !== "_") {
        camelcase += chr;
      }
    }
    return camelcase;
  }
}
function decamelize(str, joinString) {
  const lowercase = str.toLowerCase();
  joinString = joinString || "-";
  let notCamelcase = "";
  for (let i = 0;i < str.length; i++) {
    const chrLower = lowercase.charAt(i);
    const chrString = str.charAt(i);
    if (chrLower !== chrString && i > 0) {
      notCamelcase += `${joinString}${lowercase.charAt(i)}`;
    } else {
      notCamelcase += chrString;
    }
  }
  return notCamelcase;
}
function looksLikeNumber(x) {
  if (x === null || x === undefined)
    return false;
  if (typeof x === "number")
    return true;
  if (/^0x[0-9a-f]+$/i.test(x))
    return true;
  if (/^0[^.]/.test(x))
    return false;
  return /^[-]?(?:\d+(?:\.\d*)?|\.\d+)(e[-+]?\d+)?$/.test(x);
}

// node_modules/yargs-parser/build/lib/tokenize-arg-string.js
function tokenizeArgString(argString) {
  if (Array.isArray(argString)) {
    return argString.map((e) => typeof e !== "string" ? e + "" : e);
  }
  argString = argString.trim();
  let i = 0;
  let prevC = null;
  let c = null;
  let opening = null;
  const args = [];
  for (let ii = 0;ii < argString.length; ii++) {
    prevC = c;
    c = argString.charAt(ii);
    if (c === " " && !opening) {
      if (!(prevC === " ")) {
        i++;
      }
      continue;
    }
    if (c === opening) {
      opening = null;
    } else if ((c === "'" || c === '"') && !opening) {
      opening = c;
    }
    if (!args[i])
      args[i] = "";
    args[i] += c;
  }
  return args;
}

// node_modules/yargs-parser/build/lib/yargs-parser-types.js
var DefaultValuesForTypeKey;
var init_yargs_parser_types = __esm(() => {
  (function(DefaultValuesForTypeKey2) {
    DefaultValuesForTypeKey2["BOOLEAN"] = "boolean";
    DefaultValuesForTypeKey2["STRING"] = "string";
    DefaultValuesForTypeKey2["NUMBER"] = "number";
    DefaultValuesForTypeKey2["ARRAY"] = "array";
  })(DefaultValuesForTypeKey || (DefaultValuesForTypeKey = {}));
});

// node_modules/yargs-parser/build/lib/yargs-parser.js
class YargsParser {
  constructor(_mixin) {
    mixin2 = _mixin;
  }
  parse(argsInput, options) {
    const opts = Object.assign({
      alias: undefined,
      array: undefined,
      boolean: undefined,
      config: undefined,
      configObjects: undefined,
      configuration: undefined,
      coerce: undefined,
      count: undefined,
      default: undefined,
      envPrefix: undefined,
      narg: undefined,
      normalize: undefined,
      string: undefined,
      number: undefined,
      __: undefined,
      key: undefined
    }, options);
    const args = tokenizeArgString(argsInput);
    const inputIsString = typeof argsInput === "string";
    const aliases = combineAliases(Object.assign(Object.create(null), opts.alias));
    const configuration = Object.assign({
      "boolean-negation": true,
      "camel-case-expansion": true,
      "combine-arrays": false,
      "dot-notation": true,
      "duplicate-arguments-array": true,
      "flatten-duplicate-arrays": true,
      "greedy-arrays": true,
      "halt-at-non-option": false,
      "nargs-eats-options": false,
      "negation-prefix": "no-",
      "parse-numbers": true,
      "parse-positional-numbers": true,
      "populate--": false,
      "set-placeholder-key": false,
      "short-option-groups": true,
      "strip-aliased": false,
      "strip-dashed": false,
      "unknown-options-as-args": false
    }, opts.configuration);
    const defaults = Object.assign(Object.create(null), opts.default);
    const configObjects = opts.configObjects || [];
    const envPrefix = opts.envPrefix;
    const notFlagsOption = configuration["populate--"];
    const notFlagsArgv = notFlagsOption ? "--" : "_";
    const newAliases = Object.create(null);
    const defaulted = Object.create(null);
    const __ = opts.__ || mixin2.format;
    const flags = {
      aliases: Object.create(null),
      arrays: Object.create(null),
      bools: Object.create(null),
      strings: Object.create(null),
      numbers: Object.create(null),
      counts: Object.create(null),
      normalize: Object.create(null),
      configs: Object.create(null),
      nargs: Object.create(null),
      coercions: Object.create(null),
      keys: []
    };
    const negative = /^-([0-9]+(\.[0-9]+)?|\.[0-9]+)$/;
    const negatedBoolean = new RegExp("^--" + configuration["negation-prefix"] + "(.+)");
    [].concat(opts.array || []).filter(Boolean).forEach(function(opt) {
      const key = typeof opt === "object" ? opt.key : opt;
      const assignment = Object.keys(opt).map(function(key2) {
        const arrayFlagKeys = {
          boolean: "bools",
          string: "strings",
          number: "numbers"
        };
        return arrayFlagKeys[key2];
      }).filter(Boolean).pop();
      if (assignment) {
        flags[assignment][key] = true;
      }
      flags.arrays[key] = true;
      flags.keys.push(key);
    });
    [].concat(opts.boolean || []).filter(Boolean).forEach(function(key) {
      flags.bools[key] = true;
      flags.keys.push(key);
    });
    [].concat(opts.string || []).filter(Boolean).forEach(function(key) {
      flags.strings[key] = true;
      flags.keys.push(key);
    });
    [].concat(opts.number || []).filter(Boolean).forEach(function(key) {
      flags.numbers[key] = true;
      flags.keys.push(key);
    });
    [].concat(opts.count || []).filter(Boolean).forEach(function(key) {
      flags.counts[key] = true;
      flags.keys.push(key);
    });
    [].concat(opts.normalize || []).filter(Boolean).forEach(function(key) {
      flags.normalize[key] = true;
      flags.keys.push(key);
    });
    if (typeof opts.narg === "object") {
      Object.entries(opts.narg).forEach(([key, value]) => {
        if (typeof value === "number") {
          flags.nargs[key] = value;
          flags.keys.push(key);
        }
      });
    }
    if (typeof opts.coerce === "object") {
      Object.entries(opts.coerce).forEach(([key, value]) => {
        if (typeof value === "function") {
          flags.coercions[key] = value;
          flags.keys.push(key);
        }
      });
    }
    if (typeof opts.config !== "undefined") {
      if (Array.isArray(opts.config) || typeof opts.config === "string") {
        [].concat(opts.config).filter(Boolean).forEach(function(key) {
          flags.configs[key] = true;
        });
      } else if (typeof opts.config === "object") {
        Object.entries(opts.config).forEach(([key, value]) => {
          if (typeof value === "boolean" || typeof value === "function") {
            flags.configs[key] = value;
          }
        });
      }
    }
    extendAliases(opts.key, aliases, opts.default, flags.arrays);
    Object.keys(defaults).forEach(function(key) {
      (flags.aliases[key] || []).forEach(function(alias) {
        defaults[alias] = defaults[key];
      });
    });
    let error = null;
    checkConfiguration();
    let notFlags = [];
    const argv = Object.assign(Object.create(null), { _: [] });
    const argvReturn = {};
    for (let i = 0;i < args.length; i++) {
      const arg = args[i];
      const truncatedArg = arg.replace(/^-{3,}/, "---");
      let broken;
      let key;
      let letters;
      let m;
      let next;
      let value;
      if (arg !== "--" && /^-/.test(arg) && isUnknownOptionAsArg(arg)) {
        pushPositional(arg);
      } else if (truncatedArg.match(/^---+(=|$)/)) {
        pushPositional(arg);
        continue;
      } else if (arg.match(/^--.+=/) || !configuration["short-option-groups"] && arg.match(/^-.+=/)) {
        m = arg.match(/^--?([^=]+)=([\s\S]*)$/);
        if (m !== null && Array.isArray(m) && m.length >= 3) {
          if (checkAllAliases(m[1], flags.arrays)) {
            i = eatArray(i, m[1], args, m[2]);
          } else if (checkAllAliases(m[1], flags.nargs) !== false) {
            i = eatNargs(i, m[1], args, m[2]);
          } else {
            setArg(m[1], m[2], true);
          }
        }
      } else if (arg.match(negatedBoolean) && configuration["boolean-negation"]) {
        m = arg.match(negatedBoolean);
        if (m !== null && Array.isArray(m) && m.length >= 2) {
          key = m[1];
          setArg(key, checkAllAliases(key, flags.arrays) ? [false] : false);
        }
      } else if (arg.match(/^--.+/) || !configuration["short-option-groups"] && arg.match(/^-[^-]+/)) {
        m = arg.match(/^--?(.+)/);
        if (m !== null && Array.isArray(m) && m.length >= 2) {
          key = m[1];
          if (checkAllAliases(key, flags.arrays)) {
            i = eatArray(i, key, args);
          } else if (checkAllAliases(key, flags.nargs) !== false) {
            i = eatNargs(i, key, args);
          } else {
            next = args[i + 1];
            if (next !== undefined && (!next.match(/^-/) || next.match(negative)) && !checkAllAliases(key, flags.bools) && !checkAllAliases(key, flags.counts)) {
              setArg(key, next);
              i++;
            } else if (/^(true|false)$/.test(next)) {
              setArg(key, next);
              i++;
            } else {
              setArg(key, defaultValue(key));
            }
          }
        }
      } else if (arg.match(/^-.\..+=/)) {
        m = arg.match(/^-([^=]+)=([\s\S]*)$/);
        if (m !== null && Array.isArray(m) && m.length >= 3) {
          setArg(m[1], m[2]);
        }
      } else if (arg.match(/^-.\..+/) && !arg.match(negative)) {
        next = args[i + 1];
        m = arg.match(/^-(.\..+)/);
        if (m !== null && Array.isArray(m) && m.length >= 2) {
          key = m[1];
          if (next !== undefined && !next.match(/^-/) && !checkAllAliases(key, flags.bools) && !checkAllAliases(key, flags.counts)) {
            setArg(key, next);
            i++;
          } else {
            setArg(key, defaultValue(key));
          }
        }
      } else if (arg.match(/^-[^-]+/) && !arg.match(negative)) {
        letters = arg.slice(1, -1).split("");
        broken = false;
        for (let j = 0;j < letters.length; j++) {
          next = arg.slice(j + 2);
          if (letters[j + 1] && letters[j + 1] === "=") {
            value = arg.slice(j + 3);
            key = letters[j];
            if (checkAllAliases(key, flags.arrays)) {
              i = eatArray(i, key, args, value);
            } else if (checkAllAliases(key, flags.nargs) !== false) {
              i = eatNargs(i, key, args, value);
            } else {
              setArg(key, value);
            }
            broken = true;
            break;
          }
          if (next === "-") {
            setArg(letters[j], next);
            continue;
          }
          if (/[A-Za-z]/.test(letters[j]) && /^-?\d+(\.\d*)?(e-?\d+)?$/.test(next) && checkAllAliases(next, flags.bools) === false) {
            setArg(letters[j], next);
            broken = true;
            break;
          }
          if (letters[j + 1] && letters[j + 1].match(/\W/)) {
            setArg(letters[j], next);
            broken = true;
            break;
          } else {
            setArg(letters[j], defaultValue(letters[j]));
          }
        }
        key = arg.slice(-1)[0];
        if (!broken && key !== "-") {
          if (checkAllAliases(key, flags.arrays)) {
            i = eatArray(i, key, args);
          } else if (checkAllAliases(key, flags.nargs) !== false) {
            i = eatNargs(i, key, args);
          } else {
            next = args[i + 1];
            if (next !== undefined && (!/^(-|--)[^-]/.test(next) || next.match(negative)) && !checkAllAliases(key, flags.bools) && !checkAllAliases(key, flags.counts)) {
              setArg(key, next);
              i++;
            } else if (/^(true|false)$/.test(next)) {
              setArg(key, next);
              i++;
            } else {
              setArg(key, defaultValue(key));
            }
          }
        }
      } else if (arg.match(/^-[0-9]$/) && arg.match(negative) && checkAllAliases(arg.slice(1), flags.bools)) {
        key = arg.slice(1);
        setArg(key, defaultValue(key));
      } else if (arg === "--") {
        notFlags = args.slice(i + 1);
        break;
      } else if (configuration["halt-at-non-option"]) {
        notFlags = args.slice(i);
        break;
      } else {
        pushPositional(arg);
      }
    }
    applyEnvVars(argv, true);
    applyEnvVars(argv, false);
    setConfig(argv);
    setConfigObjects();
    applyDefaultsAndAliases(argv, flags.aliases, defaults, true);
    applyCoercions(argv);
    if (configuration["set-placeholder-key"])
      setPlaceholderKeys(argv);
    Object.keys(flags.counts).forEach(function(key) {
      if (!hasKey(argv, key.split(".")))
        setArg(key, 0);
    });
    if (notFlagsOption && notFlags.length)
      argv[notFlagsArgv] = [];
    notFlags.forEach(function(key) {
      argv[notFlagsArgv].push(key);
    });
    if (configuration["camel-case-expansion"] && configuration["strip-dashed"]) {
      Object.keys(argv).filter((key) => key !== "--" && key.includes("-")).forEach((key) => {
        delete argv[key];
      });
    }
    if (configuration["strip-aliased"]) {
      [].concat(...Object.keys(aliases).map((k) => aliases[k])).forEach((alias) => {
        if (configuration["camel-case-expansion"] && alias.includes("-")) {
          delete argv[alias.split(".").map((prop) => camelCase(prop)).join(".")];
        }
        delete argv[alias];
      });
    }
    function pushPositional(arg) {
      const maybeCoercedNumber = maybeCoerceNumber("_", arg);
      if (typeof maybeCoercedNumber === "string" || typeof maybeCoercedNumber === "number") {
        argv._.push(maybeCoercedNumber);
      }
    }
    function eatNargs(i, key, args2, argAfterEqualSign) {
      let ii;
      let toEat = checkAllAliases(key, flags.nargs);
      toEat = typeof toEat !== "number" || isNaN(toEat) ? 1 : toEat;
      if (toEat === 0) {
        if (!isUndefined(argAfterEqualSign)) {
          error = Error(__("Argument unexpected for: %s", key));
        }
        setArg(key, defaultValue(key));
        return i;
      }
      let available = isUndefined(argAfterEqualSign) ? 0 : 1;
      if (configuration["nargs-eats-options"]) {
        if (args2.length - (i + 1) + available < toEat) {
          error = Error(__("Not enough arguments following: %s", key));
        }
        available = toEat;
      } else {
        for (ii = i + 1;ii < args2.length; ii++) {
          if (!args2[ii].match(/^-[^0-9]/) || args2[ii].match(negative) || isUnknownOptionAsArg(args2[ii]))
            available++;
          else
            break;
        }
        if (available < toEat)
          error = Error(__("Not enough arguments following: %s", key));
      }
      let consumed = Math.min(available, toEat);
      if (!isUndefined(argAfterEqualSign) && consumed > 0) {
        setArg(key, argAfterEqualSign);
        consumed--;
      }
      for (ii = i + 1;ii < consumed + i + 1; ii++) {
        setArg(key, args2[ii]);
      }
      return i + consumed;
    }
    function eatArray(i, key, args2, argAfterEqualSign) {
      let argsToSet = [];
      let next = argAfterEqualSign || args2[i + 1];
      const nargsCount = checkAllAliases(key, flags.nargs);
      if (checkAllAliases(key, flags.bools) && !/^(true|false)$/.test(next)) {
        argsToSet.push(true);
      } else if (isUndefined(next) || isUndefined(argAfterEqualSign) && /^-/.test(next) && !negative.test(next) && !isUnknownOptionAsArg(next)) {
        if (defaults[key] !== undefined) {
          const defVal = defaults[key];
          argsToSet = Array.isArray(defVal) ? defVal : [defVal];
        }
      } else {
        if (!isUndefined(argAfterEqualSign)) {
          argsToSet.push(processValue(key, argAfterEqualSign, true));
        }
        for (let ii = i + 1;ii < args2.length; ii++) {
          if (!configuration["greedy-arrays"] && argsToSet.length > 0 || nargsCount && typeof nargsCount === "number" && argsToSet.length >= nargsCount)
            break;
          next = args2[ii];
          if (/^-/.test(next) && !negative.test(next) && !isUnknownOptionAsArg(next))
            break;
          i = ii;
          argsToSet.push(processValue(key, next, inputIsString));
        }
      }
      if (typeof nargsCount === "number" && (nargsCount && argsToSet.length < nargsCount || isNaN(nargsCount) && argsToSet.length === 0)) {
        error = Error(__("Not enough arguments following: %s", key));
      }
      setArg(key, argsToSet);
      return i;
    }
    function setArg(key, val, shouldStripQuotes = inputIsString) {
      if (/-/.test(key) && configuration["camel-case-expansion"]) {
        const alias = key.split(".").map(function(prop) {
          return camelCase(prop);
        }).join(".");
        addNewAlias(key, alias);
      }
      const value = processValue(key, val, shouldStripQuotes);
      const splitKey = key.split(".");
      setKey(argv, splitKey, value);
      if (flags.aliases[key]) {
        flags.aliases[key].forEach(function(x) {
          const keyProperties = x.split(".");
          setKey(argv, keyProperties, value);
        });
      }
      if (splitKey.length > 1 && configuration["dot-notation"]) {
        (flags.aliases[splitKey[0]] || []).forEach(function(x) {
          let keyProperties = x.split(".");
          const a = [].concat(splitKey);
          a.shift();
          keyProperties = keyProperties.concat(a);
          if (!(flags.aliases[key] || []).includes(keyProperties.join("."))) {
            setKey(argv, keyProperties, value);
          }
        });
      }
      if (checkAllAliases(key, flags.normalize) && !checkAllAliases(key, flags.arrays)) {
        const keys = [key].concat(flags.aliases[key] || []);
        keys.forEach(function(key2) {
          Object.defineProperty(argvReturn, key2, {
            enumerable: true,
            get() {
              return val;
            },
            set(value2) {
              val = typeof value2 === "string" ? mixin2.normalize(value2) : value2;
            }
          });
        });
      }
    }
    function addNewAlias(key, alias) {
      if (!(flags.aliases[key] && flags.aliases[key].length)) {
        flags.aliases[key] = [alias];
        newAliases[alias] = true;
      }
      if (!(flags.aliases[alias] && flags.aliases[alias].length)) {
        addNewAlias(alias, key);
      }
    }
    function processValue(key, val, shouldStripQuotes) {
      if (shouldStripQuotes) {
        val = stripQuotes(val);
      }
      if (checkAllAliases(key, flags.bools) || checkAllAliases(key, flags.counts)) {
        if (typeof val === "string")
          val = val === "true";
      }
      let value = Array.isArray(val) ? val.map(function(v) {
        return maybeCoerceNumber(key, v);
      }) : maybeCoerceNumber(key, val);
      if (checkAllAliases(key, flags.counts) && (isUndefined(value) || typeof value === "boolean")) {
        value = increment();
      }
      if (checkAllAliases(key, flags.normalize) && checkAllAliases(key, flags.arrays)) {
        if (Array.isArray(val))
          value = val.map((val2) => {
            return mixin2.normalize(val2);
          });
        else
          value = mixin2.normalize(val);
      }
      return value;
    }
    function maybeCoerceNumber(key, value) {
      if (!configuration["parse-positional-numbers"] && key === "_")
        return value;
      if (!checkAllAliases(key, flags.strings) && !checkAllAliases(key, flags.bools) && !Array.isArray(value)) {
        const shouldCoerceNumber = looksLikeNumber(value) && configuration["parse-numbers"] && Number.isSafeInteger(Math.floor(parseFloat(`${value}`)));
        if (shouldCoerceNumber || !isUndefined(value) && checkAllAliases(key, flags.numbers)) {
          value = Number(value);
        }
      }
      return value;
    }
    function setConfig(argv2) {
      const configLookup = Object.create(null);
      applyDefaultsAndAliases(configLookup, flags.aliases, defaults);
      Object.keys(flags.configs).forEach(function(configKey) {
        const configPath = argv2[configKey] || configLookup[configKey];
        if (configPath) {
          try {
            let config = null;
            const resolvedConfigPath = mixin2.resolve(mixin2.cwd(), configPath);
            const resolveConfig = flags.configs[configKey];
            if (typeof resolveConfig === "function") {
              try {
                config = resolveConfig(resolvedConfigPath);
              } catch (e) {
                config = e;
              }
              if (config instanceof Error) {
                error = config;
                return;
              }
            } else {
              config = mixin2.require(resolvedConfigPath);
            }
            setConfigObject(config);
          } catch (ex) {
            if (ex.name === "PermissionDenied")
              error = ex;
            else if (argv2[configKey])
              error = Error(__("Invalid JSON config file: %s", configPath));
          }
        }
      });
    }
    function setConfigObject(config, prev) {
      Object.keys(config).forEach(function(key) {
        const value = config[key];
        const fullKey = prev ? prev + "." + key : key;
        if (typeof value === "object" && value !== null && !Array.isArray(value) && configuration["dot-notation"]) {
          setConfigObject(value, fullKey);
        } else {
          if (!hasKey(argv, fullKey.split(".")) || checkAllAliases(fullKey, flags.arrays) && configuration["combine-arrays"]) {
            setArg(fullKey, value);
          }
        }
      });
    }
    function setConfigObjects() {
      if (typeof configObjects !== "undefined") {
        configObjects.forEach(function(configObject) {
          setConfigObject(configObject);
        });
      }
    }
    function applyEnvVars(argv2, configOnly) {
      if (typeof envPrefix === "undefined")
        return;
      const prefix = typeof envPrefix === "string" ? envPrefix : "";
      const env = mixin2.env();
      Object.keys(env).forEach(function(envVar) {
        if (prefix === "" || envVar.lastIndexOf(prefix, 0) === 0) {
          const keys = envVar.split("__").map(function(key, i) {
            if (i === 0) {
              key = key.substring(prefix.length);
            }
            return camelCase(key);
          });
          if ((configOnly && flags.configs[keys.join(".")] || !configOnly) && !hasKey(argv2, keys)) {
            setArg(keys.join("."), env[envVar]);
          }
        }
      });
    }
    function applyCoercions(argv2) {
      let coerce;
      const applied = new Set;
      Object.keys(argv2).forEach(function(key) {
        if (!applied.has(key)) {
          coerce = checkAllAliases(key, flags.coercions);
          if (typeof coerce === "function") {
            try {
              const value = maybeCoerceNumber(key, coerce(argv2[key]));
              [].concat(flags.aliases[key] || [], key).forEach((ali) => {
                applied.add(ali);
                argv2[ali] = value;
              });
            } catch (err) {
              error = err;
            }
          }
        }
      });
    }
    function setPlaceholderKeys(argv2) {
      flags.keys.forEach((key) => {
        if (~key.indexOf("."))
          return;
        if (typeof argv2[key] === "undefined")
          argv2[key] = undefined;
      });
      return argv2;
    }
    function applyDefaultsAndAliases(obj, aliases2, defaults2, canLog = false) {
      Object.keys(defaults2).forEach(function(key) {
        if (!hasKey(obj, key.split("."))) {
          setKey(obj, key.split("."), defaults2[key]);
          if (canLog)
            defaulted[key] = true;
          (aliases2[key] || []).forEach(function(x) {
            if (hasKey(obj, x.split(".")))
              return;
            setKey(obj, x.split("."), defaults2[key]);
          });
        }
      });
    }
    function hasKey(obj, keys) {
      let o = obj;
      if (!configuration["dot-notation"])
        keys = [keys.join(".")];
      keys.slice(0, -1).forEach(function(key2) {
        o = o[key2] || {};
      });
      const key = keys[keys.length - 1];
      if (typeof o !== "object")
        return false;
      else
        return key in o;
    }
    function setKey(obj, keys, value) {
      let o = obj;
      if (!configuration["dot-notation"])
        keys = [keys.join(".")];
      keys.slice(0, -1).forEach(function(key2) {
        key2 = sanitizeKey(key2);
        if (typeof o === "object" && o[key2] === undefined) {
          o[key2] = {};
        }
        if (typeof o[key2] !== "object" || Array.isArray(o[key2])) {
          if (Array.isArray(o[key2])) {
            o[key2].push({});
          } else {
            o[key2] = [o[key2], {}];
          }
          o = o[key2][o[key2].length - 1];
        } else {
          o = o[key2];
        }
      });
      const key = sanitizeKey(keys[keys.length - 1]);
      const isTypeArray = checkAllAliases(keys.join("."), flags.arrays);
      const isValueArray = Array.isArray(value);
      let duplicate = configuration["duplicate-arguments-array"];
      if (!duplicate && checkAllAliases(key, flags.nargs)) {
        duplicate = true;
        if (!isUndefined(o[key]) && flags.nargs[key] === 1 || Array.isArray(o[key]) && o[key].length === flags.nargs[key]) {
          o[key] = undefined;
        }
      }
      if (value === increment()) {
        o[key] = increment(o[key]);
      } else if (Array.isArray(o[key])) {
        if (duplicate && isTypeArray && isValueArray) {
          o[key] = configuration["flatten-duplicate-arrays"] ? o[key].concat(value) : (Array.isArray(o[key][0]) ? o[key] : [o[key]]).concat([value]);
        } else if (!duplicate && Boolean(isTypeArray) === Boolean(isValueArray)) {
          o[key] = value;
        } else {
          o[key] = o[key].concat([value]);
        }
      } else if (o[key] === undefined && isTypeArray) {
        o[key] = isValueArray ? value : [value];
      } else if (duplicate && !(o[key] === undefined || checkAllAliases(key, flags.counts) || checkAllAliases(key, flags.bools))) {
        o[key] = [o[key], value];
      } else {
        o[key] = value;
      }
    }
    function extendAliases(...args2) {
      args2.forEach(function(obj) {
        Object.keys(obj || {}).forEach(function(key) {
          if (flags.aliases[key])
            return;
          flags.aliases[key] = [].concat(aliases[key] || []);
          flags.aliases[key].concat(key).forEach(function(x) {
            if (/-/.test(x) && configuration["camel-case-expansion"]) {
              const c = camelCase(x);
              if (c !== key && flags.aliases[key].indexOf(c) === -1) {
                flags.aliases[key].push(c);
                newAliases[c] = true;
              }
            }
          });
          flags.aliases[key].concat(key).forEach(function(x) {
            if (x.length > 1 && /[A-Z]/.test(x) && configuration["camel-case-expansion"]) {
              const c = decamelize(x, "-");
              if (c !== key && flags.aliases[key].indexOf(c) === -1) {
                flags.aliases[key].push(c);
                newAliases[c] = true;
              }
            }
          });
          flags.aliases[key].forEach(function(x) {
            flags.aliases[x] = [key].concat(flags.aliases[key].filter(function(y) {
              return x !== y;
            }));
          });
        });
      });
    }
    function checkAllAliases(key, flag) {
      const toCheck = [].concat(flags.aliases[key] || [], key);
      const keys = Object.keys(flag);
      const setAlias = toCheck.find((key2) => keys.includes(key2));
      return setAlias ? flag[setAlias] : false;
    }
    function hasAnyFlag(key) {
      const flagsKeys = Object.keys(flags);
      const toCheck = [].concat(flagsKeys.map((k) => flags[k]));
      return toCheck.some(function(flag) {
        return Array.isArray(flag) ? flag.includes(key) : flag[key];
      });
    }
    function hasFlagsMatching(arg, ...patterns) {
      const toCheck = [].concat(...patterns);
      return toCheck.some(function(pattern) {
        const match = arg.match(pattern);
        return match && hasAnyFlag(match[1]);
      });
    }
    function hasAllShortFlags(arg) {
      if (arg.match(negative) || !arg.match(/^-[^-]+/)) {
        return false;
      }
      let hasAllFlags = true;
      let next;
      const letters = arg.slice(1).split("");
      for (let j = 0;j < letters.length; j++) {
        next = arg.slice(j + 2);
        if (!hasAnyFlag(letters[j])) {
          hasAllFlags = false;
          break;
        }
        if (letters[j + 1] && letters[j + 1] === "=" || next === "-" || /[A-Za-z]/.test(letters[j]) && /^-?\d+(\.\d*)?(e-?\d+)?$/.test(next) || letters[j + 1] && letters[j + 1].match(/\W/)) {
          break;
        }
      }
      return hasAllFlags;
    }
    function isUnknownOptionAsArg(arg) {
      return configuration["unknown-options-as-args"] && isUnknownOption(arg);
    }
    function isUnknownOption(arg) {
      arg = arg.replace(/^-{3,}/, "--");
      if (arg.match(negative)) {
        return false;
      }
      if (hasAllShortFlags(arg)) {
        return false;
      }
      const flagWithEquals = /^-+([^=]+?)=[\s\S]*$/;
      const normalFlag = /^-+([^=]+?)$/;
      const flagEndingInHyphen = /^-+([^=]+?)-$/;
      const flagEndingInDigits = /^-+([^=]+?\d+)$/;
      const flagEndingInNonWordCharacters = /^-+([^=]+?)\W+.*$/;
      return !hasFlagsMatching(arg, flagWithEquals, negatedBoolean, normalFlag, flagEndingInHyphen, flagEndingInDigits, flagEndingInNonWordCharacters);
    }
    function defaultValue(key) {
      if (!checkAllAliases(key, flags.bools) && !checkAllAliases(key, flags.counts) && `${key}` in defaults) {
        return defaults[key];
      } else {
        return defaultForType(guessType(key));
      }
    }
    function defaultForType(type) {
      const def = {
        [DefaultValuesForTypeKey.BOOLEAN]: true,
        [DefaultValuesForTypeKey.STRING]: "",
        [DefaultValuesForTypeKey.NUMBER]: undefined,
        [DefaultValuesForTypeKey.ARRAY]: []
      };
      return def[type];
    }
    function guessType(key) {
      let type = DefaultValuesForTypeKey.BOOLEAN;
      if (checkAllAliases(key, flags.strings))
        type = DefaultValuesForTypeKey.STRING;
      else if (checkAllAliases(key, flags.numbers))
        type = DefaultValuesForTypeKey.NUMBER;
      else if (checkAllAliases(key, flags.bools))
        type = DefaultValuesForTypeKey.BOOLEAN;
      else if (checkAllAliases(key, flags.arrays))
        type = DefaultValuesForTypeKey.ARRAY;
      return type;
    }
    function isUndefined(num) {
      return num === undefined;
    }
    function checkConfiguration() {
      Object.keys(flags.counts).find((key) => {
        if (checkAllAliases(key, flags.arrays)) {
          error = Error(__("Invalid configuration: %s, opts.count excludes opts.array.", key));
          return true;
        } else if (checkAllAliases(key, flags.nargs)) {
          error = Error(__("Invalid configuration: %s, opts.count excludes opts.narg.", key));
          return true;
        }
        return false;
      });
    }
    return {
      aliases: Object.assign({}, flags.aliases),
      argv: Object.assign(argvReturn, argv),
      configuration,
      defaulted: Object.assign({}, defaulted),
      error,
      newAliases: Object.assign({}, newAliases)
    };
  }
}
function combineAliases(aliases) {
  const aliasArrays = [];
  const combined = Object.create(null);
  let change = true;
  Object.keys(aliases).forEach(function(key) {
    aliasArrays.push([].concat(aliases[key], key));
  });
  while (change) {
    change = false;
    for (let i = 0;i < aliasArrays.length; i++) {
      for (let ii = i + 1;ii < aliasArrays.length; ii++) {
        const intersect = aliasArrays[i].filter(function(v) {
          return aliasArrays[ii].indexOf(v) !== -1;
        });
        if (intersect.length) {
          aliasArrays[i] = aliasArrays[i].concat(aliasArrays[ii]);
          aliasArrays.splice(ii, 1);
          change = true;
          break;
        }
      }
    }
  }
  aliasArrays.forEach(function(aliasArray) {
    aliasArray = aliasArray.filter(function(v, i, self) {
      return self.indexOf(v) === i;
    });
    const lastAlias = aliasArray.pop();
    if (lastAlias !== undefined && typeof lastAlias === "string") {
      combined[lastAlias] = aliasArray;
    }
  });
  return combined;
}
function increment(orig) {
  return orig !== undefined ? orig + 1 : 1;
}
function sanitizeKey(key) {
  if (key === "__proto__")
    return "___proto___";
  return key;
}
function stripQuotes(val) {
  return typeof val === "string" && (val[0] === "'" || val[0] === '"') && val[val.length - 1] === val[0] ? val.substring(1, val.length - 1) : val;
}
var mixin2;
var init_yargs_parser = __esm(() => {
  init_yargs_parser_types();
});

// node_modules/yargs-parser/build/lib/index.js
import { format } from "util";
import { normalize, resolve as resolve2 } from "path";
var _a, _b, _c, minNodeVersion, nodeVersion, env, parser2, yargsParser = function Parser(args, opts) {
  const result = parser2.parse(args.slice(), opts);
  return result.argv;
}, lib_default;
var init_lib2 = __esm(() => {
  init_yargs_parser();
  minNodeVersion = process && process.env && process.env.YARGS_MIN_NODE_VERSION ? Number(process.env.YARGS_MIN_NODE_VERSION) : 12;
  nodeVersion = (_b = (_a = process === null || process === undefined ? undefined : process.versions) === null || _a === undefined ? undefined : _a.node) !== null && _b !== undefined ? _b : (_c = process === null || process === undefined ? undefined : process.version) === null || _c === undefined ? undefined : _c.slice(1);
  if (nodeVersion) {
    const major = Number(nodeVersion.match(/^([^.]+)/)[1]);
    if (major < minNodeVersion) {
      throw Error(`yargs parser supports a minimum Node.js version of ${minNodeVersion}. Read our version support policy: https://github.com/yargs/yargs-parser#supported-nodejs-versions`);
    }
  }
  env = process ? process.env : {};
  parser2 = new YargsParser({
    cwd: process.cwd,
    env: () => {
      return env;
    },
    format,
    normalize,
    resolve: resolve2,
    require: (path) => {
      if (true) {
        return __require(path);
      } else
        ;
    }
  });
  yargsParser.detailed = function(args, opts) {
    return parser2.parse(args.slice(), opts);
  };
  yargsParser.camelCase = camelCase;
  yargsParser.decamelize = decamelize;
  yargsParser.looksLikeNumber = looksLikeNumber;
  lib_default = yargsParser;
});

// node_modules/yargs/build/lib/utils/process-argv.js
function getProcessArgvBinIndex() {
  if (isBundledElectronApp())
    return 0;
  return 1;
}
function isBundledElectronApp() {
  return isElectronApp() && !process.defaultApp;
}
function isElectronApp() {
  return !!process.versions.electron;
}
function getProcessArgvBin() {
  return process.argv[getProcessArgvBinIndex()];
}

// node_modules/yargs/build/lib/yerror.js
var YError;
var init_yerror = __esm(() => {
  YError = class YError extends Error {
    constructor(msg) {
      super(msg || "yargs error");
      this.name = "YError";
      if (Error.captureStackTrace) {
        Error.captureStackTrace(this, YError);
      }
    }
  };
});

// node_modules/y18n/build/lib/platform-shims/node.js
import { readFileSync, statSync as statSync2, writeFile } from "fs";
import { format as format2 } from "util";
import { resolve as resolve3 } from "path";
var node_default;
var init_node = __esm(() => {
  node_default = {
    fs: {
      readFileSync,
      writeFile
    },
    format: format2,
    resolve: resolve3,
    exists: (file) => {
      try {
        return statSync2(file).isFile();
      } catch (err) {
        return false;
      }
    }
  };
});

// node_modules/y18n/build/lib/index.js
class Y18N {
  constructor(opts) {
    opts = opts || {};
    this.directory = opts.directory || "./locales";
    this.updateFiles = typeof opts.updateFiles === "boolean" ? opts.updateFiles : true;
    this.locale = opts.locale || "en";
    this.fallbackToLanguage = typeof opts.fallbackToLanguage === "boolean" ? opts.fallbackToLanguage : true;
    this.cache = Object.create(null);
    this.writeQueue = [];
  }
  __(...args) {
    if (typeof arguments[0] !== "string") {
      return this._taggedLiteral(arguments[0], ...arguments);
    }
    const str = args.shift();
    let cb = function() {};
    if (typeof args[args.length - 1] === "function")
      cb = args.pop();
    cb = cb || function() {};
    if (!this.cache[this.locale])
      this._readLocaleFile();
    if (!this.cache[this.locale][str] && this.updateFiles) {
      this.cache[this.locale][str] = str;
      this._enqueueWrite({
        directory: this.directory,
        locale: this.locale,
        cb
      });
    } else {
      cb();
    }
    return shim.format.apply(shim.format, [this.cache[this.locale][str] || str].concat(args));
  }
  __n() {
    const args = Array.prototype.slice.call(arguments);
    const singular = args.shift();
    const plural = args.shift();
    const quantity = args.shift();
    let cb = function() {};
    if (typeof args[args.length - 1] === "function")
      cb = args.pop();
    if (!this.cache[this.locale])
      this._readLocaleFile();
    let str = quantity === 1 ? singular : plural;
    if (this.cache[this.locale][singular]) {
      const entry = this.cache[this.locale][singular];
      str = entry[quantity === 1 ? "one" : "other"];
    }
    if (!this.cache[this.locale][singular] && this.updateFiles) {
      this.cache[this.locale][singular] = {
        one: singular,
        other: plural
      };
      this._enqueueWrite({
        directory: this.directory,
        locale: this.locale,
        cb
      });
    } else {
      cb();
    }
    const values = [str];
    if (~str.indexOf("%d"))
      values.push(quantity);
    return shim.format.apply(shim.format, values.concat(args));
  }
  setLocale(locale) {
    this.locale = locale;
  }
  getLocale() {
    return this.locale;
  }
  updateLocale(obj) {
    if (!this.cache[this.locale])
      this._readLocaleFile();
    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        this.cache[this.locale][key] = obj[key];
      }
    }
  }
  _taggedLiteral(parts, ...args) {
    let str = "";
    parts.forEach(function(part, i) {
      const arg = args[i + 1];
      str += part;
      if (typeof arg !== "undefined") {
        str += "%s";
      }
    });
    return this.__.apply(this, [str].concat([].slice.call(args, 1)));
  }
  _enqueueWrite(work) {
    this.writeQueue.push(work);
    if (this.writeQueue.length === 1)
      this._processWriteQueue();
  }
  _processWriteQueue() {
    const _this = this;
    const work = this.writeQueue[0];
    const directory = work.directory;
    const locale = work.locale;
    const cb = work.cb;
    const languageFile = this._resolveLocaleFile(directory, locale);
    const serializedLocale = JSON.stringify(this.cache[locale], null, 2);
    shim.fs.writeFile(languageFile, serializedLocale, "utf-8", function(err) {
      _this.writeQueue.shift();
      if (_this.writeQueue.length > 0)
        _this._processWriteQueue();
      cb(err);
    });
  }
  _readLocaleFile() {
    let localeLookup = {};
    const languageFile = this._resolveLocaleFile(this.directory, this.locale);
    try {
      if (shim.fs.readFileSync) {
        localeLookup = JSON.parse(shim.fs.readFileSync(languageFile, "utf-8"));
      }
    } catch (err) {
      if (err instanceof SyntaxError) {
        err.message = "syntax error in " + languageFile;
      }
      if (err.code === "ENOENT")
        localeLookup = {};
      else
        throw err;
    }
    this.cache[this.locale] = localeLookup;
  }
  _resolveLocaleFile(directory, locale) {
    let file = shim.resolve(directory, "./", locale + ".json");
    if (this.fallbackToLanguage && !this._fileExistsSync(file) && ~locale.lastIndexOf("_")) {
      const languageFile = shim.resolve(directory, "./", locale.split("_")[0] + ".json");
      if (this._fileExistsSync(languageFile))
        file = languageFile;
    }
    return file;
  }
  _fileExistsSync(file) {
    return shim.exists(file);
  }
}
function y18n(opts, _shim) {
  shim = _shim;
  const y18n2 = new Y18N(opts);
  return {
    __: y18n2.__.bind(y18n2),
    __n: y18n2.__n.bind(y18n2),
    setLocale: y18n2.setLocale.bind(y18n2),
    getLocale: y18n2.getLocale.bind(y18n2),
    updateLocale: y18n2.updateLocale.bind(y18n2),
    locale: y18n2.locale
  };
}
var shim;

// node_modules/y18n/index.mjs
var y18n2 = (opts) => {
  return y18n(opts, node_default);
}, y18n_default;
var init_y18n = __esm(() => {
  init_node();
  y18n_default = y18n2;
});

// node_modules/yargs/lib/platform-shims/esm.mjs
import { notStrictEqual, strictEqual } from "assert";
import { inspect } from "util";
import { readFileSync as readFileSync2 } from "fs";
import { fileURLToPath } from "url";
import { basename, dirname as dirname2, extname, relative, resolve as resolve4 } from "path";
var REQUIRE_ERROR = "require is not supported by ESM", REQUIRE_DIRECTORY_ERROR = "loading a directory of commands is not supported yet for ESM", __dirname2, mainFilename, esm_default;
var init_esm = __esm(() => {
  init_cliui();
  init_sync();
  init_lib2();
  init_yerror();
  init_y18n();
  try {
    __dirname2 = fileURLToPath(import.meta.url);
  } catch (e) {
    __dirname2 = process.cwd();
  }
  mainFilename = __dirname2.substring(0, __dirname2.lastIndexOf("node_modules"));
  esm_default = {
    assert: {
      notStrictEqual,
      strictEqual
    },
    cliui: ui,
    findUp: sync_default,
    getEnv: (key) => {
      return process.env[key];
    },
    inspect,
    getCallerFile: () => {
      throw new YError(REQUIRE_DIRECTORY_ERROR);
    },
    getProcessArgvBin,
    mainFilename: mainFilename || process.cwd(),
    Parser: lib_default,
    path: {
      basename,
      dirname: dirname2,
      extname,
      relative,
      resolve: resolve4
    },
    process: {
      argv: () => process.argv,
      cwd: process.cwd,
      emitWarning: (warning, type) => process.emitWarning(warning, type),
      execPath: () => process.execPath,
      exit: process.exit,
      nextTick: process.nextTick,
      stdColumns: typeof process.stdout.columns !== "undefined" ? process.stdout.columns : null
    },
    readFileSync: readFileSync2,
    require: () => {
      throw new YError(REQUIRE_ERROR);
    },
    requireDirectory: () => {
      throw new YError(REQUIRE_DIRECTORY_ERROR);
    },
    stringWidth: (str) => {
      return [...str].length;
    },
    y18n: y18n_default({
      directory: resolve4(__dirname2, "../../../locales"),
      updateFiles: false
    })
  };
});

// node_modules/yargs/build/lib/typings/common-types.js
function assertNotStrictEqual(actual, expected, shim2, message) {
  shim2.assert.notStrictEqual(actual, expected, message);
}
function assertSingleKey(actual, shim2) {
  shim2.assert.strictEqual(typeof actual, "string");
}
function objectKeys(object) {
  return Object.keys(object);
}

// node_modules/yargs/build/lib/utils/is-promise.js
function isPromise(maybePromise) {
  return !!maybePromise && !!maybePromise.then && typeof maybePromise.then === "function";
}

// node_modules/yargs/build/lib/parse-command.js
function parseCommand(cmd) {
  const extraSpacesStrippedCommand = cmd.replace(/\s{2,}/g, " ");
  const splitCommand = extraSpacesStrippedCommand.split(/\s+(?![^[]*]|[^<]*>)/);
  const bregex = /\.*[\][<>]/g;
  const firstCommand = splitCommand.shift();
  if (!firstCommand)
    throw new Error(`No command found in: ${cmd}`);
  const parsedCommand = {
    cmd: firstCommand.replace(bregex, ""),
    demanded: [],
    optional: []
  };
  splitCommand.forEach((cmd2, i) => {
    let variadic = false;
    cmd2 = cmd2.replace(/\s/g, "");
    if (/\.+[\]>]/.test(cmd2) && i === splitCommand.length - 1)
      variadic = true;
    if (/^\[/.test(cmd2)) {
      parsedCommand.optional.push({
        cmd: cmd2.replace(bregex, "").split("|"),
        variadic
      });
    } else {
      parsedCommand.demanded.push({
        cmd: cmd2.replace(bregex, "").split("|"),
        variadic
      });
    }
  });
  return parsedCommand;
}

// node_modules/yargs/build/lib/argsert.js
function argsert(arg1, arg2, arg3) {
  function parseArgs() {
    return typeof arg1 === "object" ? [{ demanded: [], optional: [] }, arg1, arg2] : [
      parseCommand(`cmd ${arg1}`),
      arg2,
      arg3
    ];
  }
  try {
    let position = 0;
    const [parsed, callerArguments, _length] = parseArgs();
    const args = [].slice.call(callerArguments);
    while (args.length && args[args.length - 1] === undefined)
      args.pop();
    const length = _length || args.length;
    if (length < parsed.demanded.length) {
      throw new YError(`Not enough arguments provided. Expected ${parsed.demanded.length} but received ${args.length}.`);
    }
    const totalCommands = parsed.demanded.length + parsed.optional.length;
    if (length > totalCommands) {
      throw new YError(`Too many arguments provided. Expected max ${totalCommands} but received ${length}.`);
    }
    parsed.demanded.forEach((demanded) => {
      const arg = args.shift();
      const observedType = guessType(arg);
      const matchingTypes = demanded.cmd.filter((type) => type === observedType || type === "*");
      if (matchingTypes.length === 0)
        argumentTypeError(observedType, demanded.cmd, position);
      position += 1;
    });
    parsed.optional.forEach((optional) => {
      if (args.length === 0)
        return;
      const arg = args.shift();
      const observedType = guessType(arg);
      const matchingTypes = optional.cmd.filter((type) => type === observedType || type === "*");
      if (matchingTypes.length === 0)
        argumentTypeError(observedType, optional.cmd, position);
      position += 1;
    });
  } catch (err) {
    console.warn(err.stack);
  }
}
function guessType(arg) {
  if (Array.isArray(arg)) {
    return "array";
  } else if (arg === null) {
    return "null";
  }
  return typeof arg;
}
function argumentTypeError(observedType, allowedTypes, position) {
  throw new YError(`Invalid ${positionName[position] || "manyith"} argument. Expected ${allowedTypes.join(" or ")} but received ${observedType}.`);
}
var positionName;
var init_argsert = __esm(() => {
  init_yerror();
  positionName = ["first", "second", "third", "fourth", "fifth", "sixth"];
});

// node_modules/yargs/build/lib/middleware.js
class GlobalMiddleware {
  constructor(yargs) {
    this.globalMiddleware = [];
    this.frozens = [];
    this.yargs = yargs;
  }
  addMiddleware(callback, applyBeforeValidation, global = true, mutates = false) {
    argsert("<array|function> [boolean] [boolean] [boolean]", [callback, applyBeforeValidation, global], arguments.length);
    if (Array.isArray(callback)) {
      for (let i = 0;i < callback.length; i++) {
        if (typeof callback[i] !== "function") {
          throw Error("middleware must be a function");
        }
        const m = callback[i];
        m.applyBeforeValidation = applyBeforeValidation;
        m.global = global;
      }
      Array.prototype.push.apply(this.globalMiddleware, callback);
    } else if (typeof callback === "function") {
      const m = callback;
      m.applyBeforeValidation = applyBeforeValidation;
      m.global = global;
      m.mutates = mutates;
      this.globalMiddleware.push(callback);
    }
    return this.yargs;
  }
  addCoerceMiddleware(callback, option) {
    const aliases = this.yargs.getAliases();
    this.globalMiddleware = this.globalMiddleware.filter((m) => {
      const toCheck = [...aliases[option] || [], option];
      if (!m.option)
        return true;
      else
        return !toCheck.includes(m.option);
    });
    callback.option = option;
    return this.addMiddleware(callback, true, true, true);
  }
  getMiddleware() {
    return this.globalMiddleware;
  }
  freeze() {
    this.frozens.push([...this.globalMiddleware]);
  }
  unfreeze() {
    const frozen = this.frozens.pop();
    if (frozen !== undefined)
      this.globalMiddleware = frozen;
  }
  reset() {
    this.globalMiddleware = this.globalMiddleware.filter((m) => m.global);
  }
}
function commandMiddlewareFactory(commandMiddleware) {
  if (!commandMiddleware)
    return [];
  return commandMiddleware.map((middleware) => {
    middleware.applyBeforeValidation = false;
    return middleware;
  });
}
function applyMiddleware(argv, yargs, middlewares, beforeValidation) {
  return middlewares.reduce((acc, middleware) => {
    if (middleware.applyBeforeValidation !== beforeValidation) {
      return acc;
    }
    if (middleware.mutates) {
      if (middleware.applied)
        return acc;
      middleware.applied = true;
    }
    if (isPromise(acc)) {
      return acc.then((initialObj) => Promise.all([initialObj, middleware(initialObj, yargs)])).then(([initialObj, middlewareObj]) => Object.assign(initialObj, middlewareObj));
    } else {
      const result = middleware(acc, yargs);
      return isPromise(result) ? result.then((middlewareObj) => Object.assign(acc, middlewareObj)) : Object.assign(acc, result);
    }
  }, argv);
}
var init_middleware = __esm(() => {
  init_argsert();
});

// node_modules/yargs/build/lib/utils/maybe-async-result.js
function maybeAsyncResult(getResult, resultHandler, errorHandler = (err) => {
  throw err;
}) {
  try {
    const result = isFunction(getResult) ? getResult() : getResult;
    return isPromise(result) ? result.then((result2) => resultHandler(result2)) : resultHandler(result);
  } catch (err) {
    return errorHandler(err);
  }
}
function isFunction(arg) {
  return typeof arg === "function";
}
var init_maybe_async_result = () => {};

// node_modules/yargs/build/lib/utils/which-module.js
function whichModule(exported) {
  if (false)
    ;
  for (let i = 0, files = Object.keys(__require.cache), mod;i < files.length; i++) {
    mod = __require.cache[files[i]];
    if (mod.exports === exported)
      return mod;
  }
  return null;
}
var init_which_module = () => {};

// node_modules/yargs/build/lib/command.js
class CommandInstance {
  constructor(usage, validation, globalMiddleware, shim2) {
    this.requireCache = new Set;
    this.handlers = {};
    this.aliasMap = {};
    this.frozens = [];
    this.shim = shim2;
    this.usage = usage;
    this.globalMiddleware = globalMiddleware;
    this.validation = validation;
  }
  addDirectory(dir, req, callerFile, opts) {
    opts = opts || {};
    if (typeof opts.recurse !== "boolean")
      opts.recurse = false;
    if (!Array.isArray(opts.extensions))
      opts.extensions = ["js"];
    const parentVisit = typeof opts.visit === "function" ? opts.visit : (o) => o;
    opts.visit = (obj, joined, filename) => {
      const visited = parentVisit(obj, joined, filename);
      if (visited) {
        if (this.requireCache.has(joined))
          return visited;
        else
          this.requireCache.add(joined);
        this.addHandler(visited);
      }
      return visited;
    };
    this.shim.requireDirectory({ require: req, filename: callerFile }, dir, opts);
  }
  addHandler(cmd, description, builder, handler, commandMiddleware, deprecated) {
    let aliases = [];
    const middlewares = commandMiddlewareFactory(commandMiddleware);
    handler = handler || (() => {});
    if (Array.isArray(cmd)) {
      if (isCommandAndAliases(cmd)) {
        [cmd, ...aliases] = cmd;
      } else {
        for (const command of cmd) {
          this.addHandler(command);
        }
      }
    } else if (isCommandHandlerDefinition(cmd)) {
      let command = Array.isArray(cmd.command) || typeof cmd.command === "string" ? cmd.command : this.moduleName(cmd);
      if (cmd.aliases)
        command = [].concat(command).concat(cmd.aliases);
      this.addHandler(command, this.extractDesc(cmd), cmd.builder, cmd.handler, cmd.middlewares, cmd.deprecated);
      return;
    } else if (isCommandBuilderDefinition(builder)) {
      this.addHandler([cmd].concat(aliases), description, builder.builder, builder.handler, builder.middlewares, builder.deprecated);
      return;
    }
    if (typeof cmd === "string") {
      const parsedCommand = parseCommand(cmd);
      aliases = aliases.map((alias) => parseCommand(alias).cmd);
      let isDefault = false;
      const parsedAliases = [parsedCommand.cmd].concat(aliases).filter((c) => {
        if (DEFAULT_MARKER.test(c)) {
          isDefault = true;
          return false;
        }
        return true;
      });
      if (parsedAliases.length === 0 && isDefault)
        parsedAliases.push("$0");
      if (isDefault) {
        parsedCommand.cmd = parsedAliases[0];
        aliases = parsedAliases.slice(1);
        cmd = cmd.replace(DEFAULT_MARKER, parsedCommand.cmd);
      }
      aliases.forEach((alias) => {
        this.aliasMap[alias] = parsedCommand.cmd;
      });
      if (description !== false) {
        this.usage.command(cmd, description, isDefault, aliases, deprecated);
      }
      this.handlers[parsedCommand.cmd] = {
        original: cmd,
        description,
        handler,
        builder: builder || {},
        middlewares,
        deprecated,
        demanded: parsedCommand.demanded,
        optional: parsedCommand.optional
      };
      if (isDefault)
        this.defaultCommand = this.handlers[parsedCommand.cmd];
    }
  }
  getCommandHandlers() {
    return this.handlers;
  }
  getCommands() {
    return Object.keys(this.handlers).concat(Object.keys(this.aliasMap));
  }
  hasDefaultCommand() {
    return !!this.defaultCommand;
  }
  runCommand(command, yargs, parsed, commandIndex, helpOnly, helpOrVersionSet) {
    const commandHandler = this.handlers[command] || this.handlers[this.aliasMap[command]] || this.defaultCommand;
    const currentContext = yargs.getInternalMethods().getContext();
    const parentCommands = currentContext.commands.slice();
    const isDefaultCommand = !command;
    if (command) {
      currentContext.commands.push(command);
      currentContext.fullCommands.push(commandHandler.original);
    }
    const builderResult = this.applyBuilderUpdateUsageAndParse(isDefaultCommand, commandHandler, yargs, parsed.aliases, parentCommands, commandIndex, helpOnly, helpOrVersionSet);
    return isPromise(builderResult) ? builderResult.then((result) => this.applyMiddlewareAndGetResult(isDefaultCommand, commandHandler, result.innerArgv, currentContext, helpOnly, result.aliases, yargs)) : this.applyMiddlewareAndGetResult(isDefaultCommand, commandHandler, builderResult.innerArgv, currentContext, helpOnly, builderResult.aliases, yargs);
  }
  applyBuilderUpdateUsageAndParse(isDefaultCommand, commandHandler, yargs, aliases, parentCommands, commandIndex, helpOnly, helpOrVersionSet) {
    const builder = commandHandler.builder;
    let innerYargs = yargs;
    if (isCommandBuilderCallback(builder)) {
      yargs.getInternalMethods().getUsageInstance().freeze();
      const builderOutput = builder(yargs.getInternalMethods().reset(aliases), helpOrVersionSet);
      if (isPromise(builderOutput)) {
        return builderOutput.then((output) => {
          innerYargs = isYargsInstance(output) ? output : yargs;
          return this.parseAndUpdateUsage(isDefaultCommand, commandHandler, innerYargs, parentCommands, commandIndex, helpOnly);
        });
      }
    } else if (isCommandBuilderOptionDefinitions(builder)) {
      yargs.getInternalMethods().getUsageInstance().freeze();
      innerYargs = yargs.getInternalMethods().reset(aliases);
      Object.keys(commandHandler.builder).forEach((key) => {
        innerYargs.option(key, builder[key]);
      });
    }
    return this.parseAndUpdateUsage(isDefaultCommand, commandHandler, innerYargs, parentCommands, commandIndex, helpOnly);
  }
  parseAndUpdateUsage(isDefaultCommand, commandHandler, innerYargs, parentCommands, commandIndex, helpOnly) {
    if (isDefaultCommand)
      innerYargs.getInternalMethods().getUsageInstance().unfreeze(true);
    if (this.shouldUpdateUsage(innerYargs)) {
      innerYargs.getInternalMethods().getUsageInstance().usage(this.usageFromParentCommandsCommandHandler(parentCommands, commandHandler), commandHandler.description);
    }
    const innerArgv = innerYargs.getInternalMethods().runYargsParserAndExecuteCommands(null, undefined, true, commandIndex, helpOnly);
    return isPromise(innerArgv) ? innerArgv.then((argv) => ({
      aliases: innerYargs.parsed.aliases,
      innerArgv: argv
    })) : {
      aliases: innerYargs.parsed.aliases,
      innerArgv
    };
  }
  shouldUpdateUsage(yargs) {
    return !yargs.getInternalMethods().getUsageInstance().getUsageDisabled() && yargs.getInternalMethods().getUsageInstance().getUsage().length === 0;
  }
  usageFromParentCommandsCommandHandler(parentCommands, commandHandler) {
    const c = DEFAULT_MARKER.test(commandHandler.original) ? commandHandler.original.replace(DEFAULT_MARKER, "").trim() : commandHandler.original;
    const pc = parentCommands.filter((c2) => {
      return !DEFAULT_MARKER.test(c2);
    });
    pc.push(c);
    return `$0 ${pc.join(" ")}`;
  }
  handleValidationAndGetResult(isDefaultCommand, commandHandler, innerArgv, currentContext, aliases, yargs, middlewares, positionalMap) {
    if (!yargs.getInternalMethods().getHasOutput()) {
      const validation = yargs.getInternalMethods().runValidation(aliases, positionalMap, yargs.parsed.error, isDefaultCommand);
      innerArgv = maybeAsyncResult(innerArgv, (result) => {
        validation(result);
        return result;
      });
    }
    if (commandHandler.handler && !yargs.getInternalMethods().getHasOutput()) {
      yargs.getInternalMethods().setHasOutput();
      const populateDoubleDash = !!yargs.getOptions().configuration["populate--"];
      yargs.getInternalMethods().postProcess(innerArgv, populateDoubleDash, false, false);
      innerArgv = applyMiddleware(innerArgv, yargs, middlewares, false);
      innerArgv = maybeAsyncResult(innerArgv, (result) => {
        const handlerResult = commandHandler.handler(result);
        return isPromise(handlerResult) ? handlerResult.then(() => result) : result;
      });
      if (!isDefaultCommand) {
        yargs.getInternalMethods().getUsageInstance().cacheHelpMessage();
      }
      if (isPromise(innerArgv) && !yargs.getInternalMethods().hasParseCallback()) {
        innerArgv.catch((error) => {
          try {
            yargs.getInternalMethods().getUsageInstance().fail(null, error);
          } catch (_err) {}
        });
      }
    }
    if (!isDefaultCommand) {
      currentContext.commands.pop();
      currentContext.fullCommands.pop();
    }
    return innerArgv;
  }
  applyMiddlewareAndGetResult(isDefaultCommand, commandHandler, innerArgv, currentContext, helpOnly, aliases, yargs) {
    let positionalMap = {};
    if (helpOnly)
      return innerArgv;
    if (!yargs.getInternalMethods().getHasOutput()) {
      positionalMap = this.populatePositionals(commandHandler, innerArgv, currentContext, yargs);
    }
    const middlewares = this.globalMiddleware.getMiddleware().slice(0).concat(commandHandler.middlewares);
    const maybePromiseArgv = applyMiddleware(innerArgv, yargs, middlewares, true);
    return isPromise(maybePromiseArgv) ? maybePromiseArgv.then((resolvedInnerArgv) => this.handleValidationAndGetResult(isDefaultCommand, commandHandler, resolvedInnerArgv, currentContext, aliases, yargs, middlewares, positionalMap)) : this.handleValidationAndGetResult(isDefaultCommand, commandHandler, maybePromiseArgv, currentContext, aliases, yargs, middlewares, positionalMap);
  }
  populatePositionals(commandHandler, argv, context, yargs) {
    argv._ = argv._.slice(context.commands.length);
    const demanded = commandHandler.demanded.slice(0);
    const optional = commandHandler.optional.slice(0);
    const positionalMap = {};
    this.validation.positionalCount(demanded.length, argv._.length);
    while (demanded.length) {
      const demand = demanded.shift();
      this.populatePositional(demand, argv, positionalMap);
    }
    while (optional.length) {
      const maybe = optional.shift();
      this.populatePositional(maybe, argv, positionalMap);
    }
    argv._ = context.commands.concat(argv._.map((a) => "" + a));
    this.postProcessPositionals(argv, positionalMap, this.cmdToParseOptions(commandHandler.original), yargs);
    return positionalMap;
  }
  populatePositional(positional, argv, positionalMap) {
    const cmd = positional.cmd[0];
    if (positional.variadic) {
      positionalMap[cmd] = argv._.splice(0).map(String);
    } else {
      if (argv._.length)
        positionalMap[cmd] = [String(argv._.shift())];
    }
  }
  cmdToParseOptions(cmdString) {
    const parseOptions = {
      array: [],
      default: {},
      alias: {},
      demand: {}
    };
    const parsed = parseCommand(cmdString);
    parsed.demanded.forEach((d) => {
      const [cmd, ...aliases] = d.cmd;
      if (d.variadic) {
        parseOptions.array.push(cmd);
        parseOptions.default[cmd] = [];
      }
      parseOptions.alias[cmd] = aliases;
      parseOptions.demand[cmd] = true;
    });
    parsed.optional.forEach((o) => {
      const [cmd, ...aliases] = o.cmd;
      if (o.variadic) {
        parseOptions.array.push(cmd);
        parseOptions.default[cmd] = [];
      }
      parseOptions.alias[cmd] = aliases;
    });
    return parseOptions;
  }
  postProcessPositionals(argv, positionalMap, parseOptions, yargs) {
    const options = Object.assign({}, yargs.getOptions());
    options.default = Object.assign(parseOptions.default, options.default);
    for (const key of Object.keys(parseOptions.alias)) {
      options.alias[key] = (options.alias[key] || []).concat(parseOptions.alias[key]);
    }
    options.array = options.array.concat(parseOptions.array);
    options.config = {};
    const unparsed = [];
    Object.keys(positionalMap).forEach((key) => {
      positionalMap[key].map((value) => {
        if (options.configuration["unknown-options-as-args"])
          options.key[key] = true;
        unparsed.push(`--${key}`);
        unparsed.push(value);
      });
    });
    if (!unparsed.length)
      return;
    const config = Object.assign({}, options.configuration, {
      "populate--": false
    });
    const parsed = this.shim.Parser.detailed(unparsed, Object.assign({}, options, {
      configuration: config
    }));
    if (parsed.error) {
      yargs.getInternalMethods().getUsageInstance().fail(parsed.error.message, parsed.error);
    } else {
      const positionalKeys = Object.keys(positionalMap);
      Object.keys(positionalMap).forEach((key) => {
        positionalKeys.push(...parsed.aliases[key]);
      });
      Object.keys(parsed.argv).forEach((key) => {
        if (positionalKeys.includes(key)) {
          if (!positionalMap[key])
            positionalMap[key] = parsed.argv[key];
          if (!this.isInConfigs(yargs, key) && !this.isDefaulted(yargs, key) && Object.prototype.hasOwnProperty.call(argv, key) && Object.prototype.hasOwnProperty.call(parsed.argv, key) && (Array.isArray(argv[key]) || Array.isArray(parsed.argv[key]))) {
            argv[key] = [].concat(argv[key], parsed.argv[key]);
          } else {
            argv[key] = parsed.argv[key];
          }
        }
      });
    }
  }
  isDefaulted(yargs, key) {
    const { default: defaults } = yargs.getOptions();
    return Object.prototype.hasOwnProperty.call(defaults, key) || Object.prototype.hasOwnProperty.call(defaults, this.shim.Parser.camelCase(key));
  }
  isInConfigs(yargs, key) {
    const { configObjects } = yargs.getOptions();
    return configObjects.some((c) => Object.prototype.hasOwnProperty.call(c, key)) || configObjects.some((c) => Object.prototype.hasOwnProperty.call(c, this.shim.Parser.camelCase(key)));
  }
  runDefaultBuilderOn(yargs) {
    if (!this.defaultCommand)
      return;
    if (this.shouldUpdateUsage(yargs)) {
      const commandString = DEFAULT_MARKER.test(this.defaultCommand.original) ? this.defaultCommand.original : this.defaultCommand.original.replace(/^[^[\]<>]*/, "$0 ");
      yargs.getInternalMethods().getUsageInstance().usage(commandString, this.defaultCommand.description);
    }
    const builder = this.defaultCommand.builder;
    if (isCommandBuilderCallback(builder)) {
      return builder(yargs, true);
    } else if (!isCommandBuilderDefinition(builder)) {
      Object.keys(builder).forEach((key) => {
        yargs.option(key, builder[key]);
      });
    }
    return;
  }
  moduleName(obj) {
    const mod = whichModule(obj);
    if (!mod)
      throw new Error(`No command name given for module: ${this.shim.inspect(obj)}`);
    return this.commandFromFilename(mod.filename);
  }
  commandFromFilename(filename) {
    return this.shim.path.basename(filename, this.shim.path.extname(filename));
  }
  extractDesc({ describe, description, desc }) {
    for (const test of [describe, description, desc]) {
      if (typeof test === "string" || test === false)
        return test;
      assertNotStrictEqual(test, true, this.shim);
    }
    return false;
  }
  freeze() {
    this.frozens.push({
      handlers: this.handlers,
      aliasMap: this.aliasMap,
      defaultCommand: this.defaultCommand
    });
  }
  unfreeze() {
    const frozen = this.frozens.pop();
    assertNotStrictEqual(frozen, undefined, this.shim);
    ({
      handlers: this.handlers,
      aliasMap: this.aliasMap,
      defaultCommand: this.defaultCommand
    } = frozen);
  }
  reset() {
    this.handlers = {};
    this.aliasMap = {};
    this.defaultCommand = undefined;
    this.requireCache = new Set;
    return this;
  }
}
function command(usage, validation, globalMiddleware, shim2) {
  return new CommandInstance(usage, validation, globalMiddleware, shim2);
}
function isCommandBuilderDefinition(builder) {
  return typeof builder === "object" && !!builder.builder && typeof builder.handler === "function";
}
function isCommandAndAliases(cmd) {
  return cmd.every((c) => typeof c === "string");
}
function isCommandBuilderCallback(builder) {
  return typeof builder === "function";
}
function isCommandBuilderOptionDefinitions(builder) {
  return typeof builder === "object";
}
function isCommandHandlerDefinition(cmd) {
  return typeof cmd === "object" && !Array.isArray(cmd);
}
var DEFAULT_MARKER;
var init_command = __esm(() => {
  init_middleware();
  init_yargs_factory();
  init_maybe_async_result();
  init_which_module();
  DEFAULT_MARKER = /(^\*)|(^\$0)/;
});

// node_modules/yargs/build/lib/utils/obj-filter.js
function objFilter(original = {}, filter = () => true) {
  const obj = {};
  objectKeys(original).forEach((key) => {
    if (filter(key, original[key])) {
      obj[key] = original[key];
    }
  });
  return obj;
}
var init_obj_filter = () => {};

// node_modules/yargs/build/lib/utils/set-blocking.js
function setBlocking(blocking) {
  if (typeof process === "undefined")
    return;
  [process.stdout, process.stderr].forEach((_stream) => {
    const stream = _stream;
    if (stream._handle && stream.isTTY && typeof stream._handle.setBlocking === "function") {
      stream._handle.setBlocking(blocking);
    }
  });
}

// node_modules/yargs/build/lib/usage.js
function isBoolean(fail) {
  return typeof fail === "boolean";
}
function usage(yargs, shim2) {
  const __ = shim2.y18n.__;
  const self = {};
  const fails = [];
  self.failFn = function failFn(f) {
    fails.push(f);
  };
  let failMessage = null;
  let globalFailMessage = null;
  let showHelpOnFail = true;
  self.showHelpOnFail = function showHelpOnFailFn(arg1 = true, arg2) {
    const [enabled, message] = typeof arg1 === "string" ? [true, arg1] : [arg1, arg2];
    if (yargs.getInternalMethods().isGlobalContext()) {
      globalFailMessage = message;
    }
    failMessage = message;
    showHelpOnFail = enabled;
    return self;
  };
  let failureOutput = false;
  self.fail = function fail(msg, err) {
    const logger = yargs.getInternalMethods().getLoggerInstance();
    if (fails.length) {
      for (let i = fails.length - 1;i >= 0; --i) {
        const fail2 = fails[i];
        if (isBoolean(fail2)) {
          if (err)
            throw err;
          else if (msg)
            throw Error(msg);
        } else {
          fail2(msg, err, self);
        }
      }
    } else {
      if (yargs.getExitProcess())
        setBlocking(true);
      if (!failureOutput) {
        failureOutput = true;
        if (showHelpOnFail) {
          yargs.showHelp("error");
          logger.error();
        }
        if (msg || err)
          logger.error(msg || err);
        const globalOrCommandFailMessage = failMessage || globalFailMessage;
        if (globalOrCommandFailMessage) {
          if (msg || err)
            logger.error("");
          logger.error(globalOrCommandFailMessage);
        }
      }
      err = err || new YError(msg);
      if (yargs.getExitProcess()) {
        return yargs.exit(1);
      } else if (yargs.getInternalMethods().hasParseCallback()) {
        return yargs.exit(1, err);
      } else {
        throw err;
      }
    }
  };
  let usages = [];
  let usageDisabled = false;
  self.usage = (msg, description) => {
    if (msg === null) {
      usageDisabled = true;
      usages = [];
      return self;
    }
    usageDisabled = false;
    usages.push([msg, description || ""]);
    return self;
  };
  self.getUsage = () => {
    return usages;
  };
  self.getUsageDisabled = () => {
    return usageDisabled;
  };
  self.getPositionalGroupName = () => {
    return __("Positionals:");
  };
  let examples = [];
  self.example = (cmd, description) => {
    examples.push([cmd, description || ""]);
  };
  let commands = [];
  self.command = function command2(cmd, description, isDefault, aliases, deprecated = false) {
    if (isDefault) {
      commands = commands.map((cmdArray) => {
        cmdArray[2] = false;
        return cmdArray;
      });
    }
    commands.push([cmd, description || "", isDefault, aliases, deprecated]);
  };
  self.getCommands = () => commands;
  let descriptions = {};
  self.describe = function describe(keyOrKeys, desc) {
    if (Array.isArray(keyOrKeys)) {
      keyOrKeys.forEach((k) => {
        self.describe(k, desc);
      });
    } else if (typeof keyOrKeys === "object") {
      Object.keys(keyOrKeys).forEach((k) => {
        self.describe(k, keyOrKeys[k]);
      });
    } else {
      descriptions[keyOrKeys] = desc;
    }
  };
  self.getDescriptions = () => descriptions;
  let epilogs = [];
  self.epilog = (msg) => {
    epilogs.push(msg);
  };
  let wrapSet = false;
  let wrap2;
  self.wrap = (cols) => {
    wrapSet = true;
    wrap2 = cols;
  };
  self.getWrap = () => {
    if (shim2.getEnv("YARGS_DISABLE_WRAP")) {
      return null;
    }
    if (!wrapSet) {
      wrap2 = windowWidth();
      wrapSet = true;
    }
    return wrap2;
  };
  const deferY18nLookupPrefix = "__yargsString__:";
  self.deferY18nLookup = (str) => deferY18nLookupPrefix + str;
  self.help = function help() {
    if (cachedHelpMessage)
      return cachedHelpMessage;
    normalizeAliases();
    const base$0 = yargs.customScriptName ? yargs.$0 : shim2.path.basename(yargs.$0);
    const demandedOptions = yargs.getDemandedOptions();
    const demandedCommands = yargs.getDemandedCommands();
    const deprecatedOptions = yargs.getDeprecatedOptions();
    const groups = yargs.getGroups();
    const options = yargs.getOptions();
    let keys = [];
    keys = keys.concat(Object.keys(descriptions));
    keys = keys.concat(Object.keys(demandedOptions));
    keys = keys.concat(Object.keys(demandedCommands));
    keys = keys.concat(Object.keys(options.default));
    keys = keys.filter(filterHiddenOptions);
    keys = Object.keys(keys.reduce((acc, key) => {
      if (key !== "_")
        acc[key] = true;
      return acc;
    }, {}));
    const theWrap = self.getWrap();
    const ui2 = shim2.cliui({
      width: theWrap,
      wrap: !!theWrap
    });
    if (!usageDisabled) {
      if (usages.length) {
        usages.forEach((usage2) => {
          ui2.div({ text: `${usage2[0].replace(/\$0/g, base$0)}` });
          if (usage2[1]) {
            ui2.div({ text: `${usage2[1]}`, padding: [1, 0, 0, 0] });
          }
        });
        ui2.div();
      } else if (commands.length) {
        let u = null;
        if (demandedCommands._) {
          u = `${base$0} <${__("command")}>
`;
        } else {
          u = `${base$0} [${__("command")}]
`;
        }
        ui2.div(`${u}`);
      }
    }
    if (commands.length > 1 || commands.length === 1 && !commands[0][2]) {
      ui2.div(__("Commands:"));
      const context = yargs.getInternalMethods().getContext();
      const parentCommands = context.commands.length ? `${context.commands.join(" ")} ` : "";
      if (yargs.getInternalMethods().getParserConfiguration()["sort-commands"] === true) {
        commands = commands.sort((a, b) => a[0].localeCompare(b[0]));
      }
      const prefix = base$0 ? `${base$0} ` : "";
      commands.forEach((command2) => {
        const commandString = `${prefix}${parentCommands}${command2[0].replace(/^\$0 ?/, "")}`;
        ui2.span({
          text: commandString,
          padding: [0, 2, 0, 2],
          width: maxWidth(commands, theWrap, `${base$0}${parentCommands}`) + 4
        }, { text: command2[1] });
        const hints = [];
        if (command2[2])
          hints.push(`[${__("default")}]`);
        if (command2[3] && command2[3].length) {
          hints.push(`[${__("aliases:")} ${command2[3].join(", ")}]`);
        }
        if (command2[4]) {
          if (typeof command2[4] === "string") {
            hints.push(`[${__("deprecated: %s", command2[4])}]`);
          } else {
            hints.push(`[${__("deprecated")}]`);
          }
        }
        if (hints.length) {
          ui2.div({
            text: hints.join(" "),
            padding: [0, 0, 0, 2],
            align: "right"
          });
        } else {
          ui2.div();
        }
      });
      ui2.div();
    }
    const aliasKeys = (Object.keys(options.alias) || []).concat(Object.keys(yargs.parsed.newAliases) || []);
    keys = keys.filter((key) => !yargs.parsed.newAliases[key] && aliasKeys.every((alias) => (options.alias[alias] || []).indexOf(key) === -1));
    const defaultGroup = __("Options:");
    if (!groups[defaultGroup])
      groups[defaultGroup] = [];
    addUngroupedKeys(keys, options.alias, groups, defaultGroup);
    const isLongSwitch = (sw) => /^--/.test(getText(sw));
    const displayedGroups = Object.keys(groups).filter((groupName) => groups[groupName].length > 0).map((groupName) => {
      const normalizedKeys = groups[groupName].filter(filterHiddenOptions).map((key) => {
        if (aliasKeys.includes(key))
          return key;
        for (let i = 0, aliasKey;(aliasKey = aliasKeys[i]) !== undefined; i++) {
          if ((options.alias[aliasKey] || []).includes(key))
            return aliasKey;
        }
        return key;
      });
      return { groupName, normalizedKeys };
    }).filter(({ normalizedKeys }) => normalizedKeys.length > 0).map(({ groupName, normalizedKeys }) => {
      const switches = normalizedKeys.reduce((acc, key) => {
        acc[key] = [key].concat(options.alias[key] || []).map((sw) => {
          if (groupName === self.getPositionalGroupName())
            return sw;
          else {
            return (/^[0-9]$/.test(sw) ? options.boolean.includes(key) ? "-" : "--" : sw.length > 1 ? "--" : "-") + sw;
          }
        }).sort((sw1, sw2) => isLongSwitch(sw1) === isLongSwitch(sw2) ? 0 : isLongSwitch(sw1) ? 1 : -1).join(", ");
        return acc;
      }, {});
      return { groupName, normalizedKeys, switches };
    });
    const shortSwitchesUsed = displayedGroups.filter(({ groupName }) => groupName !== self.getPositionalGroupName()).some(({ normalizedKeys, switches }) => !normalizedKeys.every((key) => isLongSwitch(switches[key])));
    if (shortSwitchesUsed) {
      displayedGroups.filter(({ groupName }) => groupName !== self.getPositionalGroupName()).forEach(({ normalizedKeys, switches }) => {
        normalizedKeys.forEach((key) => {
          if (isLongSwitch(switches[key])) {
            switches[key] = addIndentation(switches[key], "-x, ".length);
          }
        });
      });
    }
    displayedGroups.forEach(({ groupName, normalizedKeys, switches }) => {
      ui2.div(groupName);
      normalizedKeys.forEach((key) => {
        const kswitch = switches[key];
        let desc = descriptions[key] || "";
        let type = null;
        if (desc.includes(deferY18nLookupPrefix))
          desc = __(desc.substring(deferY18nLookupPrefix.length));
        if (options.boolean.includes(key))
          type = `[${__("boolean")}]`;
        if (options.count.includes(key))
          type = `[${__("count")}]`;
        if (options.string.includes(key))
          type = `[${__("string")}]`;
        if (options.normalize.includes(key))
          type = `[${__("string")}]`;
        if (options.array.includes(key))
          type = `[${__("array")}]`;
        if (options.number.includes(key))
          type = `[${__("number")}]`;
        const deprecatedExtra = (deprecated) => typeof deprecated === "string" ? `[${__("deprecated: %s", deprecated)}]` : `[${__("deprecated")}]`;
        const extra = [
          key in deprecatedOptions ? deprecatedExtra(deprecatedOptions[key]) : null,
          type,
          key in demandedOptions ? `[${__("required")}]` : null,
          options.choices && options.choices[key] ? `[${__("choices:")} ${self.stringifiedValues(options.choices[key])}]` : null,
          defaultString(options.default[key], options.defaultDescription[key])
        ].filter(Boolean).join(" ");
        ui2.span({
          text: getText(kswitch),
          padding: [0, 2, 0, 2 + getIndentation(kswitch)],
          width: maxWidth(switches, theWrap) + 4
        }, desc);
        const shouldHideOptionExtras = yargs.getInternalMethods().getUsageConfiguration()["hide-types"] === true;
        if (extra && !shouldHideOptionExtras)
          ui2.div({ text: extra, padding: [0, 0, 0, 2], align: "right" });
        else
          ui2.div();
      });
      ui2.div();
    });
    if (examples.length) {
      ui2.div(__("Examples:"));
      examples.forEach((example) => {
        example[0] = example[0].replace(/\$0/g, base$0);
      });
      examples.forEach((example) => {
        if (example[1] === "") {
          ui2.div({
            text: example[0],
            padding: [0, 2, 0, 2]
          });
        } else {
          ui2.div({
            text: example[0],
            padding: [0, 2, 0, 2],
            width: maxWidth(examples, theWrap) + 4
          }, {
            text: example[1]
          });
        }
      });
      ui2.div();
    }
    if (epilogs.length > 0) {
      const e = epilogs.map((epilog) => epilog.replace(/\$0/g, base$0)).join(`
`);
      ui2.div(`${e}
`);
    }
    return ui2.toString().replace(/\s*$/, "");
  };
  function maxWidth(table, theWrap, modifier) {
    let width = 0;
    if (!Array.isArray(table)) {
      table = Object.values(table).map((v) => [v]);
    }
    table.forEach((v) => {
      width = Math.max(shim2.stringWidth(modifier ? `${modifier} ${getText(v[0])}` : getText(v[0])) + getIndentation(v[0]), width);
    });
    if (theWrap)
      width = Math.min(width, parseInt((theWrap * 0.5).toString(), 10));
    return width;
  }
  function normalizeAliases() {
    const demandedOptions = yargs.getDemandedOptions();
    const options = yargs.getOptions();
    (Object.keys(options.alias) || []).forEach((key) => {
      options.alias[key].forEach((alias) => {
        if (descriptions[alias])
          self.describe(key, descriptions[alias]);
        if (alias in demandedOptions)
          yargs.demandOption(key, demandedOptions[alias]);
        if (options.boolean.includes(alias))
          yargs.boolean(key);
        if (options.count.includes(alias))
          yargs.count(key);
        if (options.string.includes(alias))
          yargs.string(key);
        if (options.normalize.includes(alias))
          yargs.normalize(key);
        if (options.array.includes(alias))
          yargs.array(key);
        if (options.number.includes(alias))
          yargs.number(key);
      });
    });
  }
  let cachedHelpMessage;
  self.cacheHelpMessage = function() {
    cachedHelpMessage = this.help();
  };
  self.clearCachedHelpMessage = function() {
    cachedHelpMessage = undefined;
  };
  self.hasCachedHelpMessage = function() {
    return !!cachedHelpMessage;
  };
  function addUngroupedKeys(keys, aliases, groups, defaultGroup) {
    let groupedKeys = [];
    let toCheck = null;
    Object.keys(groups).forEach((group) => {
      groupedKeys = groupedKeys.concat(groups[group]);
    });
    keys.forEach((key) => {
      toCheck = [key].concat(aliases[key]);
      if (!toCheck.some((k) => groupedKeys.indexOf(k) !== -1)) {
        groups[defaultGroup].push(key);
      }
    });
    return groupedKeys;
  }
  function filterHiddenOptions(key) {
    return yargs.getOptions().hiddenOptions.indexOf(key) < 0 || yargs.parsed.argv[yargs.getOptions().showHiddenOpt];
  }
  self.showHelp = (level) => {
    const logger = yargs.getInternalMethods().getLoggerInstance();
    if (!level)
      level = "error";
    const emit = typeof level === "function" ? level : logger[level];
    emit(self.help());
  };
  self.functionDescription = (fn) => {
    const description = fn.name ? shim2.Parser.decamelize(fn.name, "-") : __("generated-value");
    return ["(", description, ")"].join("");
  };
  self.stringifiedValues = function stringifiedValues(values, separator) {
    let string = "";
    const sep = separator || ", ";
    const array = [].concat(values);
    if (!values || !array.length)
      return string;
    array.forEach((value) => {
      if (string.length)
        string += sep;
      string += JSON.stringify(value);
    });
    return string;
  };
  function defaultString(value, defaultDescription) {
    let string = `[${__("default:")} `;
    if (value === undefined && !defaultDescription)
      return null;
    if (defaultDescription) {
      string += defaultDescription;
    } else {
      switch (typeof value) {
        case "string":
          string += `"${value}"`;
          break;
        case "object":
          string += JSON.stringify(value);
          break;
        default:
          string += value;
      }
    }
    return `${string}]`;
  }
  function windowWidth() {
    const maxWidth2 = 80;
    if (shim2.process.stdColumns) {
      return Math.min(maxWidth2, shim2.process.stdColumns);
    } else {
      return maxWidth2;
    }
  }
  let version = null;
  self.version = (ver) => {
    version = ver;
  };
  self.showVersion = (level) => {
    const logger = yargs.getInternalMethods().getLoggerInstance();
    if (!level)
      level = "error";
    const emit = typeof level === "function" ? level : logger[level];
    emit(version);
  };
  self.reset = function reset(localLookup) {
    failMessage = null;
    failureOutput = false;
    usages = [];
    usageDisabled = false;
    epilogs = [];
    examples = [];
    commands = [];
    descriptions = objFilter(descriptions, (k) => !localLookup[k]);
    return self;
  };
  const frozens = [];
  self.freeze = function freeze() {
    frozens.push({
      failMessage,
      failureOutput,
      usages,
      usageDisabled,
      epilogs,
      examples,
      commands,
      descriptions
    });
  };
  self.unfreeze = function unfreeze(defaultCommand = false) {
    const frozen = frozens.pop();
    if (!frozen)
      return;
    if (defaultCommand) {
      descriptions = { ...frozen.descriptions, ...descriptions };
      commands = [...frozen.commands, ...commands];
      usages = [...frozen.usages, ...usages];
      examples = [...frozen.examples, ...examples];
      epilogs = [...frozen.epilogs, ...epilogs];
    } else {
      ({
        failMessage,
        failureOutput,
        usages,
        usageDisabled,
        epilogs,
        examples,
        commands,
        descriptions
      } = frozen);
    }
  };
  return self;
}
function isIndentedText(text) {
  return typeof text === "object";
}
function addIndentation(text, indent) {
  return isIndentedText(text) ? { text: text.text, indentation: text.indentation + indent } : { text, indentation: indent };
}
function getIndentation(text) {
  return isIndentedText(text) ? text.indentation : 0;
}
function getText(text) {
  return isIndentedText(text) ? text.text : text;
}
var init_usage = __esm(() => {
  init_obj_filter();
  init_yerror();
});

// node_modules/yargs/build/lib/completion-templates.js
var completionShTemplate = `###-begin-{{app_name}}-completions-###
#
# yargs command completion script
#
# Installation: {{app_path}} {{completion_command}} >> ~/.bashrc
#    or {{app_path}} {{completion_command}} >> ~/.bash_profile on OSX.
#
_{{app_name}}_yargs_completions()
{
    local cur_word args type_list

    cur_word="\${COMP_WORDS[COMP_CWORD]}"
    args=("\${COMP_WORDS[@]}")

    # ask yargs to generate completions.
    type_list=$({{app_path}} --get-yargs-completions "\${args[@]}")

    COMPREPLY=( $(compgen -W "\${type_list}" -- \${cur_word}) )

    # if no match was found, fall back to filename completion
    if [ \${#COMPREPLY[@]} -eq 0 ]; then
      COMPREPLY=()
    fi

    return 0
}
complete -o bashdefault -o default -F _{{app_name}}_yargs_completions {{app_name}}
###-end-{{app_name}}-completions-###
`, completionZshTemplate = `#compdef {{app_name}}
###-begin-{{app_name}}-completions-###
#
# yargs command completion script
#
# Installation: {{app_path}} {{completion_command}} >> ~/.zshrc
#    or {{app_path}} {{completion_command}} >> ~/.zprofile on OSX.
#
_{{app_name}}_yargs_completions()
{
  local reply
  local si=$IFS
  IFS=$'
' reply=($(COMP_CWORD="$((CURRENT-1))" COMP_LINE="$BUFFER" COMP_POINT="$CURSOR" {{app_path}} --get-yargs-completions "\${words[@]}"))
  IFS=$si
  _describe 'values' reply
}
compdef _{{app_name}}_yargs_completions {{app_name}}
###-end-{{app_name}}-completions-###
`;

// node_modules/yargs/build/lib/completion.js
class Completion {
  constructor(yargs, usage2, command2, shim2) {
    var _a2, _b2, _c2;
    this.yargs = yargs;
    this.usage = usage2;
    this.command = command2;
    this.shim = shim2;
    this.completionKey = "get-yargs-completions";
    this.aliases = null;
    this.customCompletionFunction = null;
    this.indexAfterLastReset = 0;
    this.zshShell = (_c2 = ((_a2 = this.shim.getEnv("SHELL")) === null || _a2 === undefined ? undefined : _a2.includes("zsh")) || ((_b2 = this.shim.getEnv("ZSH_NAME")) === null || _b2 === undefined ? undefined : _b2.includes("zsh"))) !== null && _c2 !== undefined ? _c2 : false;
  }
  defaultCompletion(args, argv, current, done) {
    const handlers = this.command.getCommandHandlers();
    for (let i = 0, ii = args.length;i < ii; ++i) {
      if (handlers[args[i]] && handlers[args[i]].builder) {
        const builder = handlers[args[i]].builder;
        if (isCommandBuilderCallback(builder)) {
          this.indexAfterLastReset = i + 1;
          const y = this.yargs.getInternalMethods().reset();
          builder(y, true);
          return y.argv;
        }
      }
    }
    const completions = [];
    this.commandCompletions(completions, args, current);
    this.optionCompletions(completions, args, argv, current);
    this.choicesFromOptionsCompletions(completions, args, argv, current);
    this.choicesFromPositionalsCompletions(completions, args, argv, current);
    done(null, completions);
  }
  commandCompletions(completions, args, current) {
    const parentCommands = this.yargs.getInternalMethods().getContext().commands;
    if (!current.match(/^-/) && parentCommands[parentCommands.length - 1] !== current && !this.previousArgHasChoices(args)) {
      this.usage.getCommands().forEach((usageCommand) => {
        const commandName = parseCommand(usageCommand[0]).cmd;
        if (args.indexOf(commandName) === -1) {
          if (!this.zshShell) {
            completions.push(commandName);
          } else {
            const desc = usageCommand[1] || "";
            completions.push(commandName.replace(/:/g, "\\:") + ":" + desc);
          }
        }
      });
    }
  }
  optionCompletions(completions, args, argv, current) {
    if ((current.match(/^-/) || current === "" && completions.length === 0) && !this.previousArgHasChoices(args)) {
      const options = this.yargs.getOptions();
      const positionalKeys = this.yargs.getGroups()[this.usage.getPositionalGroupName()] || [];
      Object.keys(options.key).forEach((key) => {
        const negable = !!options.configuration["boolean-negation"] && options.boolean.includes(key);
        const isPositionalKey = positionalKeys.includes(key);
        if (!isPositionalKey && !options.hiddenOptions.includes(key) && !this.argsContainKey(args, key, negable)) {
          this.completeOptionKey(key, completions, current, negable && !!options.default[key]);
        }
      });
    }
  }
  choicesFromOptionsCompletions(completions, args, argv, current) {
    if (this.previousArgHasChoices(args)) {
      const choices = this.getPreviousArgChoices(args);
      if (choices && choices.length > 0) {
        completions.push(...choices.map((c) => c.replace(/:/g, "\\:")));
      }
    }
  }
  choicesFromPositionalsCompletions(completions, args, argv, current) {
    if (current === "" && completions.length > 0 && this.previousArgHasChoices(args)) {
      return;
    }
    const positionalKeys = this.yargs.getGroups()[this.usage.getPositionalGroupName()] || [];
    const offset = Math.max(this.indexAfterLastReset, this.yargs.getInternalMethods().getContext().commands.length + 1);
    const positionalKey = positionalKeys[argv._.length - offset - 1];
    if (!positionalKey) {
      return;
    }
    const choices = this.yargs.getOptions().choices[positionalKey] || [];
    for (const choice of choices) {
      if (choice.startsWith(current)) {
        completions.push(choice.replace(/:/g, "\\:"));
      }
    }
  }
  getPreviousArgChoices(args) {
    if (args.length < 1)
      return;
    let previousArg = args[args.length - 1];
    let filter = "";
    if (!previousArg.startsWith("-") && args.length > 1) {
      filter = previousArg;
      previousArg = args[args.length - 2];
    }
    if (!previousArg.startsWith("-"))
      return;
    const previousArgKey = previousArg.replace(/^-+/, "");
    const options = this.yargs.getOptions();
    const possibleAliases = [
      previousArgKey,
      ...this.yargs.getAliases()[previousArgKey] || []
    ];
    let choices;
    for (const possibleAlias of possibleAliases) {
      if (Object.prototype.hasOwnProperty.call(options.key, possibleAlias) && Array.isArray(options.choices[possibleAlias])) {
        choices = options.choices[possibleAlias];
        break;
      }
    }
    if (choices) {
      return choices.filter((choice) => !filter || choice.startsWith(filter));
    }
  }
  previousArgHasChoices(args) {
    const choices = this.getPreviousArgChoices(args);
    return choices !== undefined && choices.length > 0;
  }
  argsContainKey(args, key, negable) {
    const argsContains = (s) => args.indexOf((/^[^0-9]$/.test(s) ? "-" : "--") + s) !== -1;
    if (argsContains(key))
      return true;
    if (negable && argsContains(`no-${key}`))
      return true;
    if (this.aliases) {
      for (const alias of this.aliases[key]) {
        if (argsContains(alias))
          return true;
      }
    }
    return false;
  }
  completeOptionKey(key, completions, current, negable) {
    var _a2, _b2, _c2, _d;
    let keyWithDesc = key;
    if (this.zshShell) {
      const descs = this.usage.getDescriptions();
      const aliasKey = (_b2 = (_a2 = this === null || this === undefined ? undefined : this.aliases) === null || _a2 === undefined ? undefined : _a2[key]) === null || _b2 === undefined ? undefined : _b2.find((alias) => {
        const desc2 = descs[alias];
        return typeof desc2 === "string" && desc2.length > 0;
      });
      const descFromAlias = aliasKey ? descs[aliasKey] : undefined;
      const desc = (_d = (_c2 = descs[key]) !== null && _c2 !== undefined ? _c2 : descFromAlias) !== null && _d !== undefined ? _d : "";
      keyWithDesc = `${key.replace(/:/g, "\\:")}:${desc.replace("__yargsString__:", "").replace(/(\r\n|\n|\r)/gm, " ")}`;
    }
    const startsByTwoDashes = (s) => /^--/.test(s);
    const isShortOption = (s) => /^[^0-9]$/.test(s);
    const dashes = !startsByTwoDashes(current) && isShortOption(key) ? "-" : "--";
    completions.push(dashes + keyWithDesc);
    if (negable) {
      completions.push(dashes + "no-" + keyWithDesc);
    }
  }
  customCompletion(args, argv, current, done) {
    assertNotStrictEqual(this.customCompletionFunction, null, this.shim);
    if (isSyncCompletionFunction(this.customCompletionFunction)) {
      const result = this.customCompletionFunction(current, argv);
      if (isPromise(result)) {
        return result.then((list) => {
          this.shim.process.nextTick(() => {
            done(null, list);
          });
        }).catch((err) => {
          this.shim.process.nextTick(() => {
            done(err, undefined);
          });
        });
      }
      return done(null, result);
    } else if (isFallbackCompletionFunction(this.customCompletionFunction)) {
      return this.customCompletionFunction(current, argv, (onCompleted = done) => this.defaultCompletion(args, argv, current, onCompleted), (completions) => {
        done(null, completions);
      });
    } else {
      return this.customCompletionFunction(current, argv, (completions) => {
        done(null, completions);
      });
    }
  }
  getCompletion(args, done) {
    const current = args.length ? args[args.length - 1] : "";
    const argv = this.yargs.parse(args, true);
    const completionFunction = this.customCompletionFunction ? (argv2) => this.customCompletion(args, argv2, current, done) : (argv2) => this.defaultCompletion(args, argv2, current, done);
    return isPromise(argv) ? argv.then(completionFunction) : completionFunction(argv);
  }
  generateCompletionScript($0, cmd) {
    let script = this.zshShell ? completionZshTemplate : completionShTemplate;
    const name = this.shim.path.basename($0);
    if ($0.match(/\.js$/))
      $0 = `./${$0}`;
    script = script.replace(/{{app_name}}/g, name);
    script = script.replace(/{{completion_command}}/g, cmd);
    return script.replace(/{{app_path}}/g, $0);
  }
  registerFunction(fn) {
    this.customCompletionFunction = fn;
  }
  setParsed(parsed) {
    this.aliases = parsed.aliases;
  }
}
function completion(yargs, usage2, command2, shim2) {
  return new Completion(yargs, usage2, command2, shim2);
}
function isSyncCompletionFunction(completionFunction) {
  return completionFunction.length < 3;
}
function isFallbackCompletionFunction(completionFunction) {
  return completionFunction.length > 3;
}
var init_completion = __esm(() => {
  init_command();
});

// node_modules/yargs/build/lib/utils/levenshtein.js
function levenshtein(a, b) {
  if (a.length === 0)
    return b.length;
  if (b.length === 0)
    return a.length;
  const matrix = [];
  let i;
  for (i = 0;i <= b.length; i++) {
    matrix[i] = [i];
  }
  let j;
  for (j = 0;j <= a.length; j++) {
    matrix[0][j] = j;
  }
  for (i = 1;i <= b.length; i++) {
    for (j = 1;j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        if (i > 1 && j > 1 && b.charAt(i - 2) === a.charAt(j - 1) && b.charAt(i - 1) === a.charAt(j - 2)) {
          matrix[i][j] = matrix[i - 2][j - 2] + 1;
        } else {
          matrix[i][j] = Math.min(matrix[i - 1][j - 1] + 1, Math.min(matrix[i][j - 1] + 1, matrix[i - 1][j] + 1));
        }
      }
    }
  }
  return matrix[b.length][a.length];
}

// node_modules/yargs/build/lib/validation.js
function validation(yargs, usage2, shim2) {
  const __ = shim2.y18n.__;
  const __n = shim2.y18n.__n;
  const self = {};
  self.nonOptionCount = function nonOptionCount(argv) {
    const demandedCommands = yargs.getDemandedCommands();
    const positionalCount = argv._.length + (argv["--"] ? argv["--"].length : 0);
    const _s = positionalCount - yargs.getInternalMethods().getContext().commands.length;
    if (demandedCommands._ && (_s < demandedCommands._.min || _s > demandedCommands._.max)) {
      if (_s < demandedCommands._.min) {
        if (demandedCommands._.minMsg !== undefined) {
          usage2.fail(demandedCommands._.minMsg ? demandedCommands._.minMsg.replace(/\$0/g, _s.toString()).replace(/\$1/, demandedCommands._.min.toString()) : null);
        } else {
          usage2.fail(__n("Not enough non-option arguments: got %s, need at least %s", "Not enough non-option arguments: got %s, need at least %s", _s, _s.toString(), demandedCommands._.min.toString()));
        }
      } else if (_s > demandedCommands._.max) {
        if (demandedCommands._.maxMsg !== undefined) {
          usage2.fail(demandedCommands._.maxMsg ? demandedCommands._.maxMsg.replace(/\$0/g, _s.toString()).replace(/\$1/, demandedCommands._.max.toString()) : null);
        } else {
          usage2.fail(__n("Too many non-option arguments: got %s, maximum of %s", "Too many non-option arguments: got %s, maximum of %s", _s, _s.toString(), demandedCommands._.max.toString()));
        }
      }
    }
  };
  self.positionalCount = function positionalCount(required, observed) {
    if (observed < required) {
      usage2.fail(__n("Not enough non-option arguments: got %s, need at least %s", "Not enough non-option arguments: got %s, need at least %s", observed, observed + "", required + ""));
    }
  };
  self.requiredArguments = function requiredArguments(argv, demandedOptions) {
    let missing = null;
    for (const key of Object.keys(demandedOptions)) {
      if (!Object.prototype.hasOwnProperty.call(argv, key) || typeof argv[key] === "undefined") {
        missing = missing || {};
        missing[key] = demandedOptions[key];
      }
    }
    if (missing) {
      const customMsgs = [];
      for (const key of Object.keys(missing)) {
        const msg = missing[key];
        if (msg && customMsgs.indexOf(msg) < 0) {
          customMsgs.push(msg);
        }
      }
      const customMsg = customMsgs.length ? `
${customMsgs.join(`
`)}` : "";
      usage2.fail(__n("Missing required argument: %s", "Missing required arguments: %s", Object.keys(missing).length, Object.keys(missing).join(", ") + customMsg));
    }
  };
  self.unknownArguments = function unknownArguments(argv, aliases, positionalMap, isDefaultCommand, checkPositionals = true) {
    var _a2;
    const commandKeys = yargs.getInternalMethods().getCommandInstance().getCommands();
    const unknown = [];
    const currentContext = yargs.getInternalMethods().getContext();
    Object.keys(argv).forEach((key) => {
      if (!specialKeys.includes(key) && !Object.prototype.hasOwnProperty.call(positionalMap, key) && !Object.prototype.hasOwnProperty.call(yargs.getInternalMethods().getParseContext(), key) && !self.isValidAndSomeAliasIsNotNew(key, aliases)) {
        unknown.push(key);
      }
    });
    if (checkPositionals && (currentContext.commands.length > 0 || commandKeys.length > 0 || isDefaultCommand)) {
      argv._.slice(currentContext.commands.length).forEach((key) => {
        if (!commandKeys.includes("" + key)) {
          unknown.push("" + key);
        }
      });
    }
    if (checkPositionals) {
      const demandedCommands = yargs.getDemandedCommands();
      const maxNonOptDemanded = ((_a2 = demandedCommands._) === null || _a2 === undefined ? undefined : _a2.max) || 0;
      const expected = currentContext.commands.length + maxNonOptDemanded;
      if (expected < argv._.length) {
        argv._.slice(expected).forEach((key) => {
          key = String(key);
          if (!currentContext.commands.includes(key) && !unknown.includes(key)) {
            unknown.push(key);
          }
        });
      }
    }
    if (unknown.length) {
      usage2.fail(__n("Unknown argument: %s", "Unknown arguments: %s", unknown.length, unknown.map((s) => s.trim() ? s : `"${s}"`).join(", ")));
    }
  };
  self.unknownCommands = function unknownCommands(argv) {
    const commandKeys = yargs.getInternalMethods().getCommandInstance().getCommands();
    const unknown = [];
    const currentContext = yargs.getInternalMethods().getContext();
    if (currentContext.commands.length > 0 || commandKeys.length > 0) {
      argv._.slice(currentContext.commands.length).forEach((key) => {
        if (!commandKeys.includes("" + key)) {
          unknown.push("" + key);
        }
      });
    }
    if (unknown.length > 0) {
      usage2.fail(__n("Unknown command: %s", "Unknown commands: %s", unknown.length, unknown.join(", ")));
      return true;
    } else {
      return false;
    }
  };
  self.isValidAndSomeAliasIsNotNew = function isValidAndSomeAliasIsNotNew(key, aliases) {
    if (!Object.prototype.hasOwnProperty.call(aliases, key)) {
      return false;
    }
    const newAliases = yargs.parsed.newAliases;
    return [key, ...aliases[key]].some((a) => !Object.prototype.hasOwnProperty.call(newAliases, a) || !newAliases[key]);
  };
  self.limitedChoices = function limitedChoices(argv) {
    const options = yargs.getOptions();
    const invalid = {};
    if (!Object.keys(options.choices).length)
      return;
    Object.keys(argv).forEach((key) => {
      if (specialKeys.indexOf(key) === -1 && Object.prototype.hasOwnProperty.call(options.choices, key)) {
        [].concat(argv[key]).forEach((value) => {
          if (options.choices[key].indexOf(value) === -1 && value !== undefined) {
            invalid[key] = (invalid[key] || []).concat(value);
          }
        });
      }
    });
    const invalidKeys = Object.keys(invalid);
    if (!invalidKeys.length)
      return;
    let msg = __("Invalid values:");
    invalidKeys.forEach((key) => {
      msg += `
  ${__("Argument: %s, Given: %s, Choices: %s", key, usage2.stringifiedValues(invalid[key]), usage2.stringifiedValues(options.choices[key]))}`;
    });
    usage2.fail(msg);
  };
  let implied = {};
  self.implies = function implies(key, value) {
    argsert("<string|object> [array|number|string]", [key, value], arguments.length);
    if (typeof key === "object") {
      Object.keys(key).forEach((k) => {
        self.implies(k, key[k]);
      });
    } else {
      yargs.global(key);
      if (!implied[key]) {
        implied[key] = [];
      }
      if (Array.isArray(value)) {
        value.forEach((i) => self.implies(key, i));
      } else {
        assertNotStrictEqual(value, undefined, shim2);
        implied[key].push(value);
      }
    }
  };
  self.getImplied = function getImplied() {
    return implied;
  };
  function keyExists(argv, val) {
    const num = Number(val);
    val = isNaN(num) ? val : num;
    if (typeof val === "number") {
      val = argv._.length >= val;
    } else if (val.match(/^--no-.+/)) {
      val = val.match(/^--no-(.+)/)[1];
      val = !Object.prototype.hasOwnProperty.call(argv, val);
    } else {
      val = Object.prototype.hasOwnProperty.call(argv, val);
    }
    return val;
  }
  self.implications = function implications(argv) {
    const implyFail = [];
    Object.keys(implied).forEach((key) => {
      const origKey = key;
      (implied[key] || []).forEach((value) => {
        let key2 = origKey;
        const origValue = value;
        key2 = keyExists(argv, key2);
        value = keyExists(argv, value);
        if (key2 && !value) {
          implyFail.push(` ${origKey} -> ${origValue}`);
        }
      });
    });
    if (implyFail.length) {
      let msg = `${__("Implications failed:")}
`;
      implyFail.forEach((value) => {
        msg += value;
      });
      usage2.fail(msg);
    }
  };
  let conflicting = {};
  self.conflicts = function conflicts(key, value) {
    argsert("<string|object> [array|string]", [key, value], arguments.length);
    if (typeof key === "object") {
      Object.keys(key).forEach((k) => {
        self.conflicts(k, key[k]);
      });
    } else {
      yargs.global(key);
      if (!conflicting[key]) {
        conflicting[key] = [];
      }
      if (Array.isArray(value)) {
        value.forEach((i) => self.conflicts(key, i));
      } else {
        conflicting[key].push(value);
      }
    }
  };
  self.getConflicting = () => conflicting;
  self.conflicting = function conflictingFn(argv) {
    Object.keys(argv).forEach((key) => {
      if (conflicting[key]) {
        conflicting[key].forEach((value) => {
          if (value && argv[key] !== undefined && argv[value] !== undefined) {
            usage2.fail(__("Arguments %s and %s are mutually exclusive", key, value));
          }
        });
      }
    });
    if (yargs.getInternalMethods().getParserConfiguration()["strip-dashed"]) {
      Object.keys(conflicting).forEach((key) => {
        conflicting[key].forEach((value) => {
          if (value && argv[shim2.Parser.camelCase(key)] !== undefined && argv[shim2.Parser.camelCase(value)] !== undefined) {
            usage2.fail(__("Arguments %s and %s are mutually exclusive", key, value));
          }
        });
      });
    }
  };
  self.recommendCommands = function recommendCommands(cmd, potentialCommands) {
    const threshold = 3;
    potentialCommands = potentialCommands.sort((a, b) => b.length - a.length);
    let recommended = null;
    let bestDistance = Infinity;
    for (let i = 0, candidate;(candidate = potentialCommands[i]) !== undefined; i++) {
      const d = levenshtein(cmd, candidate);
      if (d <= threshold && d < bestDistance) {
        bestDistance = d;
        recommended = candidate;
      }
    }
    if (recommended)
      usage2.fail(__("Did you mean %s?", recommended));
  };
  self.reset = function reset(localLookup) {
    implied = objFilter(implied, (k) => !localLookup[k]);
    conflicting = objFilter(conflicting, (k) => !localLookup[k]);
    return self;
  };
  const frozens = [];
  self.freeze = function freeze() {
    frozens.push({
      implied,
      conflicting
    });
  };
  self.unfreeze = function unfreeze() {
    const frozen = frozens.pop();
    assertNotStrictEqual(frozen, undefined, shim2);
    ({ implied, conflicting } = frozen);
  };
  return self;
}
var specialKeys;
var init_validation = __esm(() => {
  init_argsert();
  init_obj_filter();
  specialKeys = ["$0", "--", "_"];
});

// node_modules/yargs/build/lib/utils/apply-extends.js
function applyExtends(config, cwd, mergeExtends, _shim) {
  shim2 = _shim;
  let defaultConfig = {};
  if (Object.prototype.hasOwnProperty.call(config, "extends")) {
    if (typeof config.extends !== "string")
      return defaultConfig;
    const isPath = /\.json|\..*rc$/.test(config.extends);
    let pathToDefault = null;
    if (!isPath) {
      try {
        pathToDefault = __require.resolve(config.extends);
      } catch (_err) {
        return config;
      }
    } else {
      pathToDefault = getPathToDefaultConfig(cwd, config.extends);
    }
    checkForCircularExtends(pathToDefault);
    previouslyVisitedConfigs.push(pathToDefault);
    defaultConfig = isPath ? JSON.parse(shim2.readFileSync(pathToDefault, "utf8")) : __require(config.extends);
    delete config.extends;
    defaultConfig = applyExtends(defaultConfig, shim2.path.dirname(pathToDefault), mergeExtends, shim2);
  }
  previouslyVisitedConfigs = [];
  return mergeExtends ? mergeDeep(defaultConfig, config) : Object.assign({}, defaultConfig, config);
}
function checkForCircularExtends(cfgPath) {
  if (previouslyVisitedConfigs.indexOf(cfgPath) > -1) {
    throw new YError(`Circular extended configurations: '${cfgPath}'.`);
  }
}
function getPathToDefaultConfig(cwd, pathToExtend) {
  return shim2.path.resolve(cwd, pathToExtend);
}
function mergeDeep(config1, config2) {
  const target = {};
  function isObject(obj) {
    return obj && typeof obj === "object" && !Array.isArray(obj);
  }
  Object.assign(target, config1);
  for (const key of Object.keys(config2)) {
    if (isObject(config2[key]) && isObject(target[key])) {
      target[key] = mergeDeep(config1[key], config2[key]);
    } else {
      target[key] = config2[key];
    }
  }
  return target;
}
var previouslyVisitedConfigs, shim2;
var init_apply_extends = __esm(() => {
  init_yerror();
  previouslyVisitedConfigs = [];
});

// node_modules/yargs/build/lib/yargs-factory.js
function YargsFactory(_shim) {
  return (processArgs = [], cwd = _shim.process.cwd(), parentRequire) => {
    const yargs = new YargsInstance(processArgs, cwd, parentRequire, _shim);
    Object.defineProperty(yargs, "argv", {
      get: () => {
        return yargs.parse();
      },
      enumerable: true
    });
    yargs.help();
    yargs.version();
    return yargs;
  };
}
function isYargsInstance(y) {
  return !!y && typeof y.getInternalMethods === "function";
}
var __classPrivateFieldSet = function(receiver, state, value, kind, f) {
  if (kind === "m")
    throw new TypeError("Private method is not writable");
  if (kind === "a" && !f)
    throw new TypeError("Private accessor was defined without a setter");
  if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver))
    throw new TypeError("Cannot write private member to an object whose class did not declare it");
  return kind === "a" ? f.call(receiver, value) : f ? f.value = value : state.set(receiver, value), value;
}, __classPrivateFieldGet = function(receiver, state, kind, f) {
  if (kind === "a" && !f)
    throw new TypeError("Private accessor was defined without a getter");
  if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver))
    throw new TypeError("Cannot read private member from an object whose class did not declare it");
  return kind === "m" ? f : kind === "a" ? f.call(receiver) : f ? f.value : state.get(receiver);
}, _YargsInstance_command, _YargsInstance_cwd, _YargsInstance_context, _YargsInstance_completion, _YargsInstance_completionCommand, _YargsInstance_defaultShowHiddenOpt, _YargsInstance_exitError, _YargsInstance_detectLocale, _YargsInstance_emittedWarnings, _YargsInstance_exitProcess, _YargsInstance_frozens, _YargsInstance_globalMiddleware, _YargsInstance_groups, _YargsInstance_hasOutput, _YargsInstance_helpOpt, _YargsInstance_isGlobalContext, _YargsInstance_logger, _YargsInstance_output, _YargsInstance_options, _YargsInstance_parentRequire, _YargsInstance_parserConfig, _YargsInstance_parseFn, _YargsInstance_parseContext, _YargsInstance_pkgs, _YargsInstance_preservedGroups, _YargsInstance_processArgs, _YargsInstance_recommendCommands, _YargsInstance_shim, _YargsInstance_strict, _YargsInstance_strictCommands, _YargsInstance_strictOptions, _YargsInstance_usage, _YargsInstance_usageConfig, _YargsInstance_versionOpt, _YargsInstance_validation, kCopyDoubleDash, kCreateLogger, kDeleteFromParserHintObject, kEmitWarning, kFreeze, kGetDollarZero, kGetParserConfiguration, kGetUsageConfiguration, kGuessLocale, kGuessVersion, kParsePositionalNumbers, kPkgUp, kPopulateParserHintArray, kPopulateParserHintSingleValueDictionary, kPopulateParserHintArrayDictionary, kPopulateParserHintDictionary, kSanitizeKey, kSetKey, kUnfreeze, kValidateAsync, kGetCommandInstance, kGetContext, kGetHasOutput, kGetLoggerInstance, kGetParseContext, kGetUsageInstance, kGetValidationInstance, kHasParseCallback, kIsGlobalContext, kPostProcess, kRebase, kReset, kRunYargsParserAndExecuteCommands, kRunValidation, kSetHasOutput, kTrackManuallySetKeys, YargsInstance;
var init_yargs_factory = __esm(() => {
  init_command();
  init_yerror();
  init_usage();
  init_argsert();
  init_completion();
  init_validation();
  init_obj_filter();
  init_apply_extends();
  init_middleware();
  init_maybe_async_result();
  kCopyDoubleDash = Symbol("copyDoubleDash");
  kCreateLogger = Symbol("copyDoubleDash");
  kDeleteFromParserHintObject = Symbol("deleteFromParserHintObject");
  kEmitWarning = Symbol("emitWarning");
  kFreeze = Symbol("freeze");
  kGetDollarZero = Symbol("getDollarZero");
  kGetParserConfiguration = Symbol("getParserConfiguration");
  kGetUsageConfiguration = Symbol("getUsageConfiguration");
  kGuessLocale = Symbol("guessLocale");
  kGuessVersion = Symbol("guessVersion");
  kParsePositionalNumbers = Symbol("parsePositionalNumbers");
  kPkgUp = Symbol("pkgUp");
  kPopulateParserHintArray = Symbol("populateParserHintArray");
  kPopulateParserHintSingleValueDictionary = Symbol("populateParserHintSingleValueDictionary");
  kPopulateParserHintArrayDictionary = Symbol("populateParserHintArrayDictionary");
  kPopulateParserHintDictionary = Symbol("populateParserHintDictionary");
  kSanitizeKey = Symbol("sanitizeKey");
  kSetKey = Symbol("setKey");
  kUnfreeze = Symbol("unfreeze");
  kValidateAsync = Symbol("validateAsync");
  kGetCommandInstance = Symbol("getCommandInstance");
  kGetContext = Symbol("getContext");
  kGetHasOutput = Symbol("getHasOutput");
  kGetLoggerInstance = Symbol("getLoggerInstance");
  kGetParseContext = Symbol("getParseContext");
  kGetUsageInstance = Symbol("getUsageInstance");
  kGetValidationInstance = Symbol("getValidationInstance");
  kHasParseCallback = Symbol("hasParseCallback");
  kIsGlobalContext = Symbol("isGlobalContext");
  kPostProcess = Symbol("postProcess");
  kRebase = Symbol("rebase");
  kReset = Symbol("reset");
  kRunYargsParserAndExecuteCommands = Symbol("runYargsParserAndExecuteCommands");
  kRunValidation = Symbol("runValidation");
  kSetHasOutput = Symbol("setHasOutput");
  kTrackManuallySetKeys = Symbol("kTrackManuallySetKeys");
  YargsInstance = class YargsInstance {
    constructor(processArgs = [], cwd, parentRequire, shim3) {
      this.customScriptName = false;
      this.parsed = false;
      _YargsInstance_command.set(this, undefined);
      _YargsInstance_cwd.set(this, undefined);
      _YargsInstance_context.set(this, { commands: [], fullCommands: [] });
      _YargsInstance_completion.set(this, null);
      _YargsInstance_completionCommand.set(this, null);
      _YargsInstance_defaultShowHiddenOpt.set(this, "show-hidden");
      _YargsInstance_exitError.set(this, null);
      _YargsInstance_detectLocale.set(this, true);
      _YargsInstance_emittedWarnings.set(this, {});
      _YargsInstance_exitProcess.set(this, true);
      _YargsInstance_frozens.set(this, []);
      _YargsInstance_globalMiddleware.set(this, undefined);
      _YargsInstance_groups.set(this, {});
      _YargsInstance_hasOutput.set(this, false);
      _YargsInstance_helpOpt.set(this, null);
      _YargsInstance_isGlobalContext.set(this, true);
      _YargsInstance_logger.set(this, undefined);
      _YargsInstance_output.set(this, "");
      _YargsInstance_options.set(this, undefined);
      _YargsInstance_parentRequire.set(this, undefined);
      _YargsInstance_parserConfig.set(this, {});
      _YargsInstance_parseFn.set(this, null);
      _YargsInstance_parseContext.set(this, null);
      _YargsInstance_pkgs.set(this, {});
      _YargsInstance_preservedGroups.set(this, {});
      _YargsInstance_processArgs.set(this, undefined);
      _YargsInstance_recommendCommands.set(this, false);
      _YargsInstance_shim.set(this, undefined);
      _YargsInstance_strict.set(this, false);
      _YargsInstance_strictCommands.set(this, false);
      _YargsInstance_strictOptions.set(this, false);
      _YargsInstance_usage.set(this, undefined);
      _YargsInstance_usageConfig.set(this, {});
      _YargsInstance_versionOpt.set(this, null);
      _YargsInstance_validation.set(this, undefined);
      __classPrivateFieldSet(this, _YargsInstance_shim, shim3, "f");
      __classPrivateFieldSet(this, _YargsInstance_processArgs, processArgs, "f");
      __classPrivateFieldSet(this, _YargsInstance_cwd, cwd, "f");
      __classPrivateFieldSet(this, _YargsInstance_parentRequire, parentRequire, "f");
      __classPrivateFieldSet(this, _YargsInstance_globalMiddleware, new GlobalMiddleware(this), "f");
      this.$0 = this[kGetDollarZero]();
      this[kReset]();
      __classPrivateFieldSet(this, _YargsInstance_command, __classPrivateFieldGet(this, _YargsInstance_command, "f"), "f");
      __classPrivateFieldSet(this, _YargsInstance_usage, __classPrivateFieldGet(this, _YargsInstance_usage, "f"), "f");
      __classPrivateFieldSet(this, _YargsInstance_validation, __classPrivateFieldGet(this, _YargsInstance_validation, "f"), "f");
      __classPrivateFieldSet(this, _YargsInstance_options, __classPrivateFieldGet(this, _YargsInstance_options, "f"), "f");
      __classPrivateFieldGet(this, _YargsInstance_options, "f").showHiddenOpt = __classPrivateFieldGet(this, _YargsInstance_defaultShowHiddenOpt, "f");
      __classPrivateFieldSet(this, _YargsInstance_logger, this[kCreateLogger](), "f");
    }
    addHelpOpt(opt, msg) {
      const defaultHelpOpt = "help";
      argsert("[string|boolean] [string]", [opt, msg], arguments.length);
      if (__classPrivateFieldGet(this, _YargsInstance_helpOpt, "f")) {
        this[kDeleteFromParserHintObject](__classPrivateFieldGet(this, _YargsInstance_helpOpt, "f"));
        __classPrivateFieldSet(this, _YargsInstance_helpOpt, null, "f");
      }
      if (opt === false && msg === undefined)
        return this;
      __classPrivateFieldSet(this, _YargsInstance_helpOpt, typeof opt === "string" ? opt : defaultHelpOpt, "f");
      this.boolean(__classPrivateFieldGet(this, _YargsInstance_helpOpt, "f"));
      this.describe(__classPrivateFieldGet(this, _YargsInstance_helpOpt, "f"), msg || __classPrivateFieldGet(this, _YargsInstance_usage, "f").deferY18nLookup("Show help"));
      return this;
    }
    help(opt, msg) {
      return this.addHelpOpt(opt, msg);
    }
    addShowHiddenOpt(opt, msg) {
      argsert("[string|boolean] [string]", [opt, msg], arguments.length);
      if (opt === false && msg === undefined)
        return this;
      const showHiddenOpt = typeof opt === "string" ? opt : __classPrivateFieldGet(this, _YargsInstance_defaultShowHiddenOpt, "f");
      this.boolean(showHiddenOpt);
      this.describe(showHiddenOpt, msg || __classPrivateFieldGet(this, _YargsInstance_usage, "f").deferY18nLookup("Show hidden options"));
      __classPrivateFieldGet(this, _YargsInstance_options, "f").showHiddenOpt = showHiddenOpt;
      return this;
    }
    showHidden(opt, msg) {
      return this.addShowHiddenOpt(opt, msg);
    }
    alias(key, value) {
      argsert("<object|string|array> [string|array]", [key, value], arguments.length);
      this[kPopulateParserHintArrayDictionary](this.alias.bind(this), "alias", key, value);
      return this;
    }
    array(keys) {
      argsert("<array|string>", [keys], arguments.length);
      this[kPopulateParserHintArray]("array", keys);
      this[kTrackManuallySetKeys](keys);
      return this;
    }
    boolean(keys) {
      argsert("<array|string>", [keys], arguments.length);
      this[kPopulateParserHintArray]("boolean", keys);
      this[kTrackManuallySetKeys](keys);
      return this;
    }
    check(f, global) {
      argsert("<function> [boolean]", [f, global], arguments.length);
      this.middleware((argv, _yargs) => {
        return maybeAsyncResult(() => {
          return f(argv, _yargs.getOptions());
        }, (result) => {
          if (!result) {
            __classPrivateFieldGet(this, _YargsInstance_usage, "f").fail(__classPrivateFieldGet(this, _YargsInstance_shim, "f").y18n.__("Argument check failed: %s", f.toString()));
          } else if (typeof result === "string" || result instanceof Error) {
            __classPrivateFieldGet(this, _YargsInstance_usage, "f").fail(result.toString(), result);
          }
          return argv;
        }, (err) => {
          __classPrivateFieldGet(this, _YargsInstance_usage, "f").fail(err.message ? err.message : err.toString(), err);
          return argv;
        });
      }, false, global);
      return this;
    }
    choices(key, value) {
      argsert("<object|string|array> [string|array]", [key, value], arguments.length);
      this[kPopulateParserHintArrayDictionary](this.choices.bind(this), "choices", key, value);
      return this;
    }
    coerce(keys, value) {
      argsert("<object|string|array> [function]", [keys, value], arguments.length);
      if (Array.isArray(keys)) {
        if (!value) {
          throw new YError("coerce callback must be provided");
        }
        for (const key of keys) {
          this.coerce(key, value);
        }
        return this;
      } else if (typeof keys === "object") {
        for (const key of Object.keys(keys)) {
          this.coerce(key, keys[key]);
        }
        return this;
      }
      if (!value) {
        throw new YError("coerce callback must be provided");
      }
      __classPrivateFieldGet(this, _YargsInstance_options, "f").key[keys] = true;
      __classPrivateFieldGet(this, _YargsInstance_globalMiddleware, "f").addCoerceMiddleware((argv, yargs) => {
        let aliases;
        const shouldCoerce = Object.prototype.hasOwnProperty.call(argv, keys);
        if (!shouldCoerce) {
          return argv;
        }
        return maybeAsyncResult(() => {
          aliases = yargs.getAliases();
          return value(argv[keys]);
        }, (result) => {
          argv[keys] = result;
          const stripAliased = yargs.getInternalMethods().getParserConfiguration()["strip-aliased"];
          if (aliases[keys] && stripAliased !== true) {
            for (const alias of aliases[keys]) {
              argv[alias] = result;
            }
          }
          return argv;
        }, (err) => {
          throw new YError(err.message);
        });
      }, keys);
      return this;
    }
    conflicts(key1, key2) {
      argsert("<string|object> [string|array]", [key1, key2], arguments.length);
      __classPrivateFieldGet(this, _YargsInstance_validation, "f").conflicts(key1, key2);
      return this;
    }
    config(key = "config", msg, parseFn) {
      argsert("[object|string] [string|function] [function]", [key, msg, parseFn], arguments.length);
      if (typeof key === "object" && !Array.isArray(key)) {
        key = applyExtends(key, __classPrivateFieldGet(this, _YargsInstance_cwd, "f"), this[kGetParserConfiguration]()["deep-merge-config"] || false, __classPrivateFieldGet(this, _YargsInstance_shim, "f"));
        __classPrivateFieldGet(this, _YargsInstance_options, "f").configObjects = (__classPrivateFieldGet(this, _YargsInstance_options, "f").configObjects || []).concat(key);
        return this;
      }
      if (typeof msg === "function") {
        parseFn = msg;
        msg = undefined;
      }
      this.describe(key, msg || __classPrivateFieldGet(this, _YargsInstance_usage, "f").deferY18nLookup("Path to JSON config file"));
      (Array.isArray(key) ? key : [key]).forEach((k) => {
        __classPrivateFieldGet(this, _YargsInstance_options, "f").config[k] = parseFn || true;
      });
      return this;
    }
    completion(cmd, desc, fn) {
      argsert("[string] [string|boolean|function] [function]", [cmd, desc, fn], arguments.length);
      if (typeof desc === "function") {
        fn = desc;
        desc = undefined;
      }
      __classPrivateFieldSet(this, _YargsInstance_completionCommand, cmd || __classPrivateFieldGet(this, _YargsInstance_completionCommand, "f") || "completion", "f");
      if (!desc && desc !== false) {
        desc = "generate completion script";
      }
      this.command(__classPrivateFieldGet(this, _YargsInstance_completionCommand, "f"), desc);
      if (fn)
        __classPrivateFieldGet(this, _YargsInstance_completion, "f").registerFunction(fn);
      return this;
    }
    command(cmd, description, builder, handler, middlewares, deprecated) {
      argsert("<string|array|object> [string|boolean] [function|object] [function] [array] [boolean|string]", [cmd, description, builder, handler, middlewares, deprecated], arguments.length);
      __classPrivateFieldGet(this, _YargsInstance_command, "f").addHandler(cmd, description, builder, handler, middlewares, deprecated);
      return this;
    }
    commands(cmd, description, builder, handler, middlewares, deprecated) {
      return this.command(cmd, description, builder, handler, middlewares, deprecated);
    }
    commandDir(dir, opts) {
      argsert("<string> [object]", [dir, opts], arguments.length);
      const req = __classPrivateFieldGet(this, _YargsInstance_parentRequire, "f") || __classPrivateFieldGet(this, _YargsInstance_shim, "f").require;
      __classPrivateFieldGet(this, _YargsInstance_command, "f").addDirectory(dir, req, __classPrivateFieldGet(this, _YargsInstance_shim, "f").getCallerFile(), opts);
      return this;
    }
    count(keys) {
      argsert("<array|string>", [keys], arguments.length);
      this[kPopulateParserHintArray]("count", keys);
      this[kTrackManuallySetKeys](keys);
      return this;
    }
    default(key, value, defaultDescription) {
      argsert("<object|string|array> [*] [string]", [key, value, defaultDescription], arguments.length);
      if (defaultDescription) {
        assertSingleKey(key, __classPrivateFieldGet(this, _YargsInstance_shim, "f"));
        __classPrivateFieldGet(this, _YargsInstance_options, "f").defaultDescription[key] = defaultDescription;
      }
      if (typeof value === "function") {
        assertSingleKey(key, __classPrivateFieldGet(this, _YargsInstance_shim, "f"));
        if (!__classPrivateFieldGet(this, _YargsInstance_options, "f").defaultDescription[key])
          __classPrivateFieldGet(this, _YargsInstance_options, "f").defaultDescription[key] = __classPrivateFieldGet(this, _YargsInstance_usage, "f").functionDescription(value);
        value = value.call();
      }
      this[kPopulateParserHintSingleValueDictionary](this.default.bind(this), "default", key, value);
      return this;
    }
    defaults(key, value, defaultDescription) {
      return this.default(key, value, defaultDescription);
    }
    demandCommand(min = 1, max, minMsg, maxMsg) {
      argsert("[number] [number|string] [string|null|undefined] [string|null|undefined]", [min, max, minMsg, maxMsg], arguments.length);
      if (typeof max !== "number") {
        minMsg = max;
        max = Infinity;
      }
      this.global("_", false);
      __classPrivateFieldGet(this, _YargsInstance_options, "f").demandedCommands._ = {
        min,
        max,
        minMsg,
        maxMsg
      };
      return this;
    }
    demand(keys, max, msg) {
      if (Array.isArray(max)) {
        max.forEach((key) => {
          assertNotStrictEqual(msg, true, __classPrivateFieldGet(this, _YargsInstance_shim, "f"));
          this.demandOption(key, msg);
        });
        max = Infinity;
      } else if (typeof max !== "number") {
        msg = max;
        max = Infinity;
      }
      if (typeof keys === "number") {
        assertNotStrictEqual(msg, true, __classPrivateFieldGet(this, _YargsInstance_shim, "f"));
        this.demandCommand(keys, max, msg, msg);
      } else if (Array.isArray(keys)) {
        keys.forEach((key) => {
          assertNotStrictEqual(msg, true, __classPrivateFieldGet(this, _YargsInstance_shim, "f"));
          this.demandOption(key, msg);
        });
      } else {
        if (typeof msg === "string") {
          this.demandOption(keys, msg);
        } else if (msg === true || typeof msg === "undefined") {
          this.demandOption(keys);
        }
      }
      return this;
    }
    demandOption(keys, msg) {
      argsert("<object|string|array> [string]", [keys, msg], arguments.length);
      this[kPopulateParserHintSingleValueDictionary](this.demandOption.bind(this), "demandedOptions", keys, msg);
      return this;
    }
    deprecateOption(option, message) {
      argsert("<string> [string|boolean]", [option, message], arguments.length);
      __classPrivateFieldGet(this, _YargsInstance_options, "f").deprecatedOptions[option] = message;
      return this;
    }
    describe(keys, description) {
      argsert("<object|string|array> [string]", [keys, description], arguments.length);
      this[kSetKey](keys, true);
      __classPrivateFieldGet(this, _YargsInstance_usage, "f").describe(keys, description);
      return this;
    }
    detectLocale(detect) {
      argsert("<boolean>", [detect], arguments.length);
      __classPrivateFieldSet(this, _YargsInstance_detectLocale, detect, "f");
      return this;
    }
    env(prefix) {
      argsert("[string|boolean]", [prefix], arguments.length);
      if (prefix === false)
        delete __classPrivateFieldGet(this, _YargsInstance_options, "f").envPrefix;
      else
        __classPrivateFieldGet(this, _YargsInstance_options, "f").envPrefix = prefix || "";
      return this;
    }
    epilogue(msg) {
      argsert("<string>", [msg], arguments.length);
      __classPrivateFieldGet(this, _YargsInstance_usage, "f").epilog(msg);
      return this;
    }
    epilog(msg) {
      return this.epilogue(msg);
    }
    example(cmd, description) {
      argsert("<string|array> [string]", [cmd, description], arguments.length);
      if (Array.isArray(cmd)) {
        cmd.forEach((exampleParams) => this.example(...exampleParams));
      } else {
        __classPrivateFieldGet(this, _YargsInstance_usage, "f").example(cmd, description);
      }
      return this;
    }
    exit(code, err) {
      __classPrivateFieldSet(this, _YargsInstance_hasOutput, true, "f");
      __classPrivateFieldSet(this, _YargsInstance_exitError, err, "f");
      if (__classPrivateFieldGet(this, _YargsInstance_exitProcess, "f"))
        __classPrivateFieldGet(this, _YargsInstance_shim, "f").process.exit(code);
    }
    exitProcess(enabled = true) {
      argsert("[boolean]", [enabled], arguments.length);
      __classPrivateFieldSet(this, _YargsInstance_exitProcess, enabled, "f");
      return this;
    }
    fail(f) {
      argsert("<function|boolean>", [f], arguments.length);
      if (typeof f === "boolean" && f !== false) {
        throw new YError("Invalid first argument. Expected function or boolean 'false'");
      }
      __classPrivateFieldGet(this, _YargsInstance_usage, "f").failFn(f);
      return this;
    }
    getAliases() {
      return this.parsed ? this.parsed.aliases : {};
    }
    async getCompletion(args, done) {
      argsert("<array> [function]", [args, done], arguments.length);
      if (!done) {
        return new Promise((resolve5, reject) => {
          __classPrivateFieldGet(this, _YargsInstance_completion, "f").getCompletion(args, (err, completions) => {
            if (err)
              reject(err);
            else
              resolve5(completions);
          });
        });
      } else {
        return __classPrivateFieldGet(this, _YargsInstance_completion, "f").getCompletion(args, done);
      }
    }
    getDemandedOptions() {
      argsert([], 0);
      return __classPrivateFieldGet(this, _YargsInstance_options, "f").demandedOptions;
    }
    getDemandedCommands() {
      argsert([], 0);
      return __classPrivateFieldGet(this, _YargsInstance_options, "f").demandedCommands;
    }
    getDeprecatedOptions() {
      argsert([], 0);
      return __classPrivateFieldGet(this, _YargsInstance_options, "f").deprecatedOptions;
    }
    getDetectLocale() {
      return __classPrivateFieldGet(this, _YargsInstance_detectLocale, "f");
    }
    getExitProcess() {
      return __classPrivateFieldGet(this, _YargsInstance_exitProcess, "f");
    }
    getGroups() {
      return Object.assign({}, __classPrivateFieldGet(this, _YargsInstance_groups, "f"), __classPrivateFieldGet(this, _YargsInstance_preservedGroups, "f"));
    }
    getHelp() {
      __classPrivateFieldSet(this, _YargsInstance_hasOutput, true, "f");
      if (!__classPrivateFieldGet(this, _YargsInstance_usage, "f").hasCachedHelpMessage()) {
        if (!this.parsed) {
          const parse = this[kRunYargsParserAndExecuteCommands](__classPrivateFieldGet(this, _YargsInstance_processArgs, "f"), undefined, undefined, 0, true);
          if (isPromise(parse)) {
            return parse.then(() => {
              return __classPrivateFieldGet(this, _YargsInstance_usage, "f").help();
            });
          }
        }
        const builderResponse = __classPrivateFieldGet(this, _YargsInstance_command, "f").runDefaultBuilderOn(this);
        if (isPromise(builderResponse)) {
          return builderResponse.then(() => {
            return __classPrivateFieldGet(this, _YargsInstance_usage, "f").help();
          });
        }
      }
      return Promise.resolve(__classPrivateFieldGet(this, _YargsInstance_usage, "f").help());
    }
    getOptions() {
      return __classPrivateFieldGet(this, _YargsInstance_options, "f");
    }
    getStrict() {
      return __classPrivateFieldGet(this, _YargsInstance_strict, "f");
    }
    getStrictCommands() {
      return __classPrivateFieldGet(this, _YargsInstance_strictCommands, "f");
    }
    getStrictOptions() {
      return __classPrivateFieldGet(this, _YargsInstance_strictOptions, "f");
    }
    global(globals, global) {
      argsert("<string|array> [boolean]", [globals, global], arguments.length);
      globals = [].concat(globals);
      if (global !== false) {
        __classPrivateFieldGet(this, _YargsInstance_options, "f").local = __classPrivateFieldGet(this, _YargsInstance_options, "f").local.filter((l) => globals.indexOf(l) === -1);
      } else {
        globals.forEach((g) => {
          if (!__classPrivateFieldGet(this, _YargsInstance_options, "f").local.includes(g))
            __classPrivateFieldGet(this, _YargsInstance_options, "f").local.push(g);
        });
      }
      return this;
    }
    group(opts, groupName) {
      argsert("<string|array> <string>", [opts, groupName], arguments.length);
      const existing = __classPrivateFieldGet(this, _YargsInstance_preservedGroups, "f")[groupName] || __classPrivateFieldGet(this, _YargsInstance_groups, "f")[groupName];
      if (__classPrivateFieldGet(this, _YargsInstance_preservedGroups, "f")[groupName]) {
        delete __classPrivateFieldGet(this, _YargsInstance_preservedGroups, "f")[groupName];
      }
      const seen = {};
      __classPrivateFieldGet(this, _YargsInstance_groups, "f")[groupName] = (existing || []).concat(opts).filter((key) => {
        if (seen[key])
          return false;
        return seen[key] = true;
      });
      return this;
    }
    hide(key) {
      argsert("<string>", [key], arguments.length);
      __classPrivateFieldGet(this, _YargsInstance_options, "f").hiddenOptions.push(key);
      return this;
    }
    implies(key, value) {
      argsert("<string|object> [number|string|array]", [key, value], arguments.length);
      __classPrivateFieldGet(this, _YargsInstance_validation, "f").implies(key, value);
      return this;
    }
    locale(locale) {
      argsert("[string]", [locale], arguments.length);
      if (locale === undefined) {
        this[kGuessLocale]();
        return __classPrivateFieldGet(this, _YargsInstance_shim, "f").y18n.getLocale();
      }
      __classPrivateFieldSet(this, _YargsInstance_detectLocale, false, "f");
      __classPrivateFieldGet(this, _YargsInstance_shim, "f").y18n.setLocale(locale);
      return this;
    }
    middleware(callback, applyBeforeValidation, global) {
      return __classPrivateFieldGet(this, _YargsInstance_globalMiddleware, "f").addMiddleware(callback, !!applyBeforeValidation, global);
    }
    nargs(key, value) {
      argsert("<string|object|array> [number]", [key, value], arguments.length);
      this[kPopulateParserHintSingleValueDictionary](this.nargs.bind(this), "narg", key, value);
      return this;
    }
    normalize(keys) {
      argsert("<array|string>", [keys], arguments.length);
      this[kPopulateParserHintArray]("normalize", keys);
      return this;
    }
    number(keys) {
      argsert("<array|string>", [keys], arguments.length);
      this[kPopulateParserHintArray]("number", keys);
      this[kTrackManuallySetKeys](keys);
      return this;
    }
    option(key, opt) {
      argsert("<string|object> [object]", [key, opt], arguments.length);
      if (typeof key === "object") {
        Object.keys(key).forEach((k) => {
          this.options(k, key[k]);
        });
      } else {
        if (typeof opt !== "object") {
          opt = {};
        }
        this[kTrackManuallySetKeys](key);
        if (__classPrivateFieldGet(this, _YargsInstance_versionOpt, "f") && (key === "version" || (opt === null || opt === undefined ? undefined : opt.alias) === "version")) {
          this[kEmitWarning]([
            '"version" is a reserved word.',
            "Please do one of the following:",
            '- Disable version with `yargs.version(false)` if using "version" as an option',
            "- Use the built-in `yargs.version` method instead (if applicable)",
            "- Use a different option key",
            "https://yargs.js.org/docs/#api-reference-version"
          ].join(`
`), undefined, "versionWarning");
        }
        __classPrivateFieldGet(this, _YargsInstance_options, "f").key[key] = true;
        if (opt.alias)
          this.alias(key, opt.alias);
        const deprecate = opt.deprecate || opt.deprecated;
        if (deprecate) {
          this.deprecateOption(key, deprecate);
        }
        const demand = opt.demand || opt.required || opt.require;
        if (demand) {
          this.demand(key, demand);
        }
        if (opt.demandOption) {
          this.demandOption(key, typeof opt.demandOption === "string" ? opt.demandOption : undefined);
        }
        if (opt.conflicts) {
          this.conflicts(key, opt.conflicts);
        }
        if ("default" in opt) {
          this.default(key, opt.default);
        }
        if (opt.implies !== undefined) {
          this.implies(key, opt.implies);
        }
        if (opt.nargs !== undefined) {
          this.nargs(key, opt.nargs);
        }
        if (opt.config) {
          this.config(key, opt.configParser);
        }
        if (opt.normalize) {
          this.normalize(key);
        }
        if (opt.choices) {
          this.choices(key, opt.choices);
        }
        if (opt.coerce) {
          this.coerce(key, opt.coerce);
        }
        if (opt.group) {
          this.group(key, opt.group);
        }
        if (opt.boolean || opt.type === "boolean") {
          this.boolean(key);
          if (opt.alias)
            this.boolean(opt.alias);
        }
        if (opt.array || opt.type === "array") {
          this.array(key);
          if (opt.alias)
            this.array(opt.alias);
        }
        if (opt.number || opt.type === "number") {
          this.number(key);
          if (opt.alias)
            this.number(opt.alias);
        }
        if (opt.string || opt.type === "string") {
          this.string(key);
          if (opt.alias)
            this.string(opt.alias);
        }
        if (opt.count || opt.type === "count") {
          this.count(key);
        }
        if (typeof opt.global === "boolean") {
          this.global(key, opt.global);
        }
        if (opt.defaultDescription) {
          __classPrivateFieldGet(this, _YargsInstance_options, "f").defaultDescription[key] = opt.defaultDescription;
        }
        if (opt.skipValidation) {
          this.skipValidation(key);
        }
        const desc = opt.describe || opt.description || opt.desc;
        const descriptions = __classPrivateFieldGet(this, _YargsInstance_usage, "f").getDescriptions();
        if (!Object.prototype.hasOwnProperty.call(descriptions, key) || typeof desc === "string") {
          this.describe(key, desc);
        }
        if (opt.hidden) {
          this.hide(key);
        }
        if (opt.requiresArg) {
          this.requiresArg(key);
        }
      }
      return this;
    }
    options(key, opt) {
      return this.option(key, opt);
    }
    parse(args, shortCircuit, _parseFn) {
      argsert("[string|array] [function|boolean|object] [function]", [args, shortCircuit, _parseFn], arguments.length);
      this[kFreeze]();
      if (typeof args === "undefined") {
        args = __classPrivateFieldGet(this, _YargsInstance_processArgs, "f");
      }
      if (typeof shortCircuit === "object") {
        __classPrivateFieldSet(this, _YargsInstance_parseContext, shortCircuit, "f");
        shortCircuit = _parseFn;
      }
      if (typeof shortCircuit === "function") {
        __classPrivateFieldSet(this, _YargsInstance_parseFn, shortCircuit, "f");
        shortCircuit = false;
      }
      if (!shortCircuit)
        __classPrivateFieldSet(this, _YargsInstance_processArgs, args, "f");
      if (__classPrivateFieldGet(this, _YargsInstance_parseFn, "f"))
        __classPrivateFieldSet(this, _YargsInstance_exitProcess, false, "f");
      const parsed = this[kRunYargsParserAndExecuteCommands](args, !!shortCircuit);
      const tmpParsed = this.parsed;
      __classPrivateFieldGet(this, _YargsInstance_completion, "f").setParsed(this.parsed);
      if (isPromise(parsed)) {
        return parsed.then((argv) => {
          if (__classPrivateFieldGet(this, _YargsInstance_parseFn, "f"))
            __classPrivateFieldGet(this, _YargsInstance_parseFn, "f").call(this, __classPrivateFieldGet(this, _YargsInstance_exitError, "f"), argv, __classPrivateFieldGet(this, _YargsInstance_output, "f"));
          return argv;
        }).catch((err) => {
          if (__classPrivateFieldGet(this, _YargsInstance_parseFn, "f")) {
            __classPrivateFieldGet(this, _YargsInstance_parseFn, "f")(err, this.parsed.argv, __classPrivateFieldGet(this, _YargsInstance_output, "f"));
          }
          throw err;
        }).finally(() => {
          this[kUnfreeze]();
          this.parsed = tmpParsed;
        });
      } else {
        if (__classPrivateFieldGet(this, _YargsInstance_parseFn, "f"))
          __classPrivateFieldGet(this, _YargsInstance_parseFn, "f").call(this, __classPrivateFieldGet(this, _YargsInstance_exitError, "f"), parsed, __classPrivateFieldGet(this, _YargsInstance_output, "f"));
        this[kUnfreeze]();
        this.parsed = tmpParsed;
      }
      return parsed;
    }
    parseAsync(args, shortCircuit, _parseFn) {
      const maybePromise = this.parse(args, shortCircuit, _parseFn);
      return !isPromise(maybePromise) ? Promise.resolve(maybePromise) : maybePromise;
    }
    parseSync(args, shortCircuit, _parseFn) {
      const maybePromise = this.parse(args, shortCircuit, _parseFn);
      if (isPromise(maybePromise)) {
        throw new YError(".parseSync() must not be used with asynchronous builders, handlers, or middleware");
      }
      return maybePromise;
    }
    parserConfiguration(config) {
      argsert("<object>", [config], arguments.length);
      __classPrivateFieldSet(this, _YargsInstance_parserConfig, config, "f");
      return this;
    }
    pkgConf(key, rootPath) {
      argsert("<string> [string]", [key, rootPath], arguments.length);
      let conf = null;
      const obj = this[kPkgUp](rootPath || __classPrivateFieldGet(this, _YargsInstance_cwd, "f"));
      if (obj[key] && typeof obj[key] === "object") {
        conf = applyExtends(obj[key], rootPath || __classPrivateFieldGet(this, _YargsInstance_cwd, "f"), this[kGetParserConfiguration]()["deep-merge-config"] || false, __classPrivateFieldGet(this, _YargsInstance_shim, "f"));
        __classPrivateFieldGet(this, _YargsInstance_options, "f").configObjects = (__classPrivateFieldGet(this, _YargsInstance_options, "f").configObjects || []).concat(conf);
      }
      return this;
    }
    positional(key, opts) {
      argsert("<string> <object>", [key, opts], arguments.length);
      const supportedOpts = [
        "default",
        "defaultDescription",
        "implies",
        "normalize",
        "choices",
        "conflicts",
        "coerce",
        "type",
        "describe",
        "desc",
        "description",
        "alias"
      ];
      opts = objFilter(opts, (k, v) => {
        if (k === "type" && !["string", "number", "boolean"].includes(v))
          return false;
        return supportedOpts.includes(k);
      });
      const fullCommand = __classPrivateFieldGet(this, _YargsInstance_context, "f").fullCommands[__classPrivateFieldGet(this, _YargsInstance_context, "f").fullCommands.length - 1];
      const parseOptions = fullCommand ? __classPrivateFieldGet(this, _YargsInstance_command, "f").cmdToParseOptions(fullCommand) : {
        array: [],
        alias: {},
        default: {},
        demand: {}
      };
      objectKeys(parseOptions).forEach((pk) => {
        const parseOption = parseOptions[pk];
        if (Array.isArray(parseOption)) {
          if (parseOption.indexOf(key) !== -1)
            opts[pk] = true;
        } else {
          if (parseOption[key] && !(pk in opts))
            opts[pk] = parseOption[key];
        }
      });
      this.group(key, __classPrivateFieldGet(this, _YargsInstance_usage, "f").getPositionalGroupName());
      return this.option(key, opts);
    }
    recommendCommands(recommend = true) {
      argsert("[boolean]", [recommend], arguments.length);
      __classPrivateFieldSet(this, _YargsInstance_recommendCommands, recommend, "f");
      return this;
    }
    required(keys, max, msg) {
      return this.demand(keys, max, msg);
    }
    require(keys, max, msg) {
      return this.demand(keys, max, msg);
    }
    requiresArg(keys) {
      argsert("<array|string|object> [number]", [keys], arguments.length);
      if (typeof keys === "string" && __classPrivateFieldGet(this, _YargsInstance_options, "f").narg[keys]) {
        return this;
      } else {
        this[kPopulateParserHintSingleValueDictionary](this.requiresArg.bind(this), "narg", keys, NaN);
      }
      return this;
    }
    showCompletionScript($0, cmd) {
      argsert("[string] [string]", [$0, cmd], arguments.length);
      $0 = $0 || this.$0;
      __classPrivateFieldGet(this, _YargsInstance_logger, "f").log(__classPrivateFieldGet(this, _YargsInstance_completion, "f").generateCompletionScript($0, cmd || __classPrivateFieldGet(this, _YargsInstance_completionCommand, "f") || "completion"));
      return this;
    }
    showHelp(level) {
      argsert("[string|function]", [level], arguments.length);
      __classPrivateFieldSet(this, _YargsInstance_hasOutput, true, "f");
      if (!__classPrivateFieldGet(this, _YargsInstance_usage, "f").hasCachedHelpMessage()) {
        if (!this.parsed) {
          const parse = this[kRunYargsParserAndExecuteCommands](__classPrivateFieldGet(this, _YargsInstance_processArgs, "f"), undefined, undefined, 0, true);
          if (isPromise(parse)) {
            parse.then(() => {
              __classPrivateFieldGet(this, _YargsInstance_usage, "f").showHelp(level);
            });
            return this;
          }
        }
        const builderResponse = __classPrivateFieldGet(this, _YargsInstance_command, "f").runDefaultBuilderOn(this);
        if (isPromise(builderResponse)) {
          builderResponse.then(() => {
            __classPrivateFieldGet(this, _YargsInstance_usage, "f").showHelp(level);
          });
          return this;
        }
      }
      __classPrivateFieldGet(this, _YargsInstance_usage, "f").showHelp(level);
      return this;
    }
    scriptName(scriptName) {
      this.customScriptName = true;
      this.$0 = scriptName;
      return this;
    }
    showHelpOnFail(enabled, message) {
      argsert("[boolean|string] [string]", [enabled, message], arguments.length);
      __classPrivateFieldGet(this, _YargsInstance_usage, "f").showHelpOnFail(enabled, message);
      return this;
    }
    showVersion(level) {
      argsert("[string|function]", [level], arguments.length);
      __classPrivateFieldGet(this, _YargsInstance_usage, "f").showVersion(level);
      return this;
    }
    skipValidation(keys) {
      argsert("<array|string>", [keys], arguments.length);
      this[kPopulateParserHintArray]("skipValidation", keys);
      return this;
    }
    strict(enabled) {
      argsert("[boolean]", [enabled], arguments.length);
      __classPrivateFieldSet(this, _YargsInstance_strict, enabled !== false, "f");
      return this;
    }
    strictCommands(enabled) {
      argsert("[boolean]", [enabled], arguments.length);
      __classPrivateFieldSet(this, _YargsInstance_strictCommands, enabled !== false, "f");
      return this;
    }
    strictOptions(enabled) {
      argsert("[boolean]", [enabled], arguments.length);
      __classPrivateFieldSet(this, _YargsInstance_strictOptions, enabled !== false, "f");
      return this;
    }
    string(keys) {
      argsert("<array|string>", [keys], arguments.length);
      this[kPopulateParserHintArray]("string", keys);
      this[kTrackManuallySetKeys](keys);
      return this;
    }
    terminalWidth() {
      argsert([], 0);
      return __classPrivateFieldGet(this, _YargsInstance_shim, "f").process.stdColumns;
    }
    updateLocale(obj) {
      return this.updateStrings(obj);
    }
    updateStrings(obj) {
      argsert("<object>", [obj], arguments.length);
      __classPrivateFieldSet(this, _YargsInstance_detectLocale, false, "f");
      __classPrivateFieldGet(this, _YargsInstance_shim, "f").y18n.updateLocale(obj);
      return this;
    }
    usage(msg, description, builder, handler) {
      argsert("<string|null|undefined> [string|boolean] [function|object] [function]", [msg, description, builder, handler], arguments.length);
      if (description !== undefined) {
        assertNotStrictEqual(msg, null, __classPrivateFieldGet(this, _YargsInstance_shim, "f"));
        if ((msg || "").match(/^\$0( |$)/)) {
          return this.command(msg, description, builder, handler);
        } else {
          throw new YError(".usage() description must start with $0 if being used as alias for .command()");
        }
      } else {
        __classPrivateFieldGet(this, _YargsInstance_usage, "f").usage(msg);
        return this;
      }
    }
    usageConfiguration(config) {
      argsert("<object>", [config], arguments.length);
      __classPrivateFieldSet(this, _YargsInstance_usageConfig, config, "f");
      return this;
    }
    version(opt, msg, ver) {
      const defaultVersionOpt = "version";
      argsert("[boolean|string] [string] [string]", [opt, msg, ver], arguments.length);
      if (__classPrivateFieldGet(this, _YargsInstance_versionOpt, "f")) {
        this[kDeleteFromParserHintObject](__classPrivateFieldGet(this, _YargsInstance_versionOpt, "f"));
        __classPrivateFieldGet(this, _YargsInstance_usage, "f").version(undefined);
        __classPrivateFieldSet(this, _YargsInstance_versionOpt, null, "f");
      }
      if (arguments.length === 0) {
        ver = this[kGuessVersion]();
        opt = defaultVersionOpt;
      } else if (arguments.length === 1) {
        if (opt === false) {
          return this;
        }
        ver = opt;
        opt = defaultVersionOpt;
      } else if (arguments.length === 2) {
        ver = msg;
        msg = undefined;
      }
      __classPrivateFieldSet(this, _YargsInstance_versionOpt, typeof opt === "string" ? opt : defaultVersionOpt, "f");
      msg = msg || __classPrivateFieldGet(this, _YargsInstance_usage, "f").deferY18nLookup("Show version number");
      __classPrivateFieldGet(this, _YargsInstance_usage, "f").version(ver || undefined);
      this.boolean(__classPrivateFieldGet(this, _YargsInstance_versionOpt, "f"));
      this.describe(__classPrivateFieldGet(this, _YargsInstance_versionOpt, "f"), msg);
      return this;
    }
    wrap(cols) {
      argsert("<number|null|undefined>", [cols], arguments.length);
      __classPrivateFieldGet(this, _YargsInstance_usage, "f").wrap(cols);
      return this;
    }
    [(_YargsInstance_command = new WeakMap, _YargsInstance_cwd = new WeakMap, _YargsInstance_context = new WeakMap, _YargsInstance_completion = new WeakMap, _YargsInstance_completionCommand = new WeakMap, _YargsInstance_defaultShowHiddenOpt = new WeakMap, _YargsInstance_exitError = new WeakMap, _YargsInstance_detectLocale = new WeakMap, _YargsInstance_emittedWarnings = new WeakMap, _YargsInstance_exitProcess = new WeakMap, _YargsInstance_frozens = new WeakMap, _YargsInstance_globalMiddleware = new WeakMap, _YargsInstance_groups = new WeakMap, _YargsInstance_hasOutput = new WeakMap, _YargsInstance_helpOpt = new WeakMap, _YargsInstance_isGlobalContext = new WeakMap, _YargsInstance_logger = new WeakMap, _YargsInstance_output = new WeakMap, _YargsInstance_options = new WeakMap, _YargsInstance_parentRequire = new WeakMap, _YargsInstance_parserConfig = new WeakMap, _YargsInstance_parseFn = new WeakMap, _YargsInstance_parseContext = new WeakMap, _YargsInstance_pkgs = new WeakMap, _YargsInstance_preservedGroups = new WeakMap, _YargsInstance_processArgs = new WeakMap, _YargsInstance_recommendCommands = new WeakMap, _YargsInstance_shim = new WeakMap, _YargsInstance_strict = new WeakMap, _YargsInstance_strictCommands = new WeakMap, _YargsInstance_strictOptions = new WeakMap, _YargsInstance_usage = new WeakMap, _YargsInstance_usageConfig = new WeakMap, _YargsInstance_versionOpt = new WeakMap, _YargsInstance_validation = new WeakMap, kCopyDoubleDash)](argv) {
      if (!argv._ || !argv["--"])
        return argv;
      argv._.push.apply(argv._, argv["--"]);
      try {
        delete argv["--"];
      } catch (_err) {}
      return argv;
    }
    [kCreateLogger]() {
      return {
        log: (...args) => {
          if (!this[kHasParseCallback]())
            console.log(...args);
          __classPrivateFieldSet(this, _YargsInstance_hasOutput, true, "f");
          if (__classPrivateFieldGet(this, _YargsInstance_output, "f").length)
            __classPrivateFieldSet(this, _YargsInstance_output, __classPrivateFieldGet(this, _YargsInstance_output, "f") + `
`, "f");
          __classPrivateFieldSet(this, _YargsInstance_output, __classPrivateFieldGet(this, _YargsInstance_output, "f") + args.join(" "), "f");
        },
        error: (...args) => {
          if (!this[kHasParseCallback]())
            console.error(...args);
          __classPrivateFieldSet(this, _YargsInstance_hasOutput, true, "f");
          if (__classPrivateFieldGet(this, _YargsInstance_output, "f").length)
            __classPrivateFieldSet(this, _YargsInstance_output, __classPrivateFieldGet(this, _YargsInstance_output, "f") + `
`, "f");
          __classPrivateFieldSet(this, _YargsInstance_output, __classPrivateFieldGet(this, _YargsInstance_output, "f") + args.join(" "), "f");
        }
      };
    }
    [kDeleteFromParserHintObject](optionKey) {
      objectKeys(__classPrivateFieldGet(this, _YargsInstance_options, "f")).forEach((hintKey) => {
        if (((key) => key === "configObjects")(hintKey))
          return;
        const hint = __classPrivateFieldGet(this, _YargsInstance_options, "f")[hintKey];
        if (Array.isArray(hint)) {
          if (hint.includes(optionKey))
            hint.splice(hint.indexOf(optionKey), 1);
        } else if (typeof hint === "object") {
          delete hint[optionKey];
        }
      });
      delete __classPrivateFieldGet(this, _YargsInstance_usage, "f").getDescriptions()[optionKey];
    }
    [kEmitWarning](warning, type, deduplicationId) {
      if (!__classPrivateFieldGet(this, _YargsInstance_emittedWarnings, "f")[deduplicationId]) {
        __classPrivateFieldGet(this, _YargsInstance_shim, "f").process.emitWarning(warning, type);
        __classPrivateFieldGet(this, _YargsInstance_emittedWarnings, "f")[deduplicationId] = true;
      }
    }
    [kFreeze]() {
      __classPrivateFieldGet(this, _YargsInstance_frozens, "f").push({
        options: __classPrivateFieldGet(this, _YargsInstance_options, "f"),
        configObjects: __classPrivateFieldGet(this, _YargsInstance_options, "f").configObjects.slice(0),
        exitProcess: __classPrivateFieldGet(this, _YargsInstance_exitProcess, "f"),
        groups: __classPrivateFieldGet(this, _YargsInstance_groups, "f"),
        strict: __classPrivateFieldGet(this, _YargsInstance_strict, "f"),
        strictCommands: __classPrivateFieldGet(this, _YargsInstance_strictCommands, "f"),
        strictOptions: __classPrivateFieldGet(this, _YargsInstance_strictOptions, "f"),
        completionCommand: __classPrivateFieldGet(this, _YargsInstance_completionCommand, "f"),
        output: __classPrivateFieldGet(this, _YargsInstance_output, "f"),
        exitError: __classPrivateFieldGet(this, _YargsInstance_exitError, "f"),
        hasOutput: __classPrivateFieldGet(this, _YargsInstance_hasOutput, "f"),
        parsed: this.parsed,
        parseFn: __classPrivateFieldGet(this, _YargsInstance_parseFn, "f"),
        parseContext: __classPrivateFieldGet(this, _YargsInstance_parseContext, "f")
      });
      __classPrivateFieldGet(this, _YargsInstance_usage, "f").freeze();
      __classPrivateFieldGet(this, _YargsInstance_validation, "f").freeze();
      __classPrivateFieldGet(this, _YargsInstance_command, "f").freeze();
      __classPrivateFieldGet(this, _YargsInstance_globalMiddleware, "f").freeze();
    }
    [kGetDollarZero]() {
      let $0 = "";
      let default$0;
      if (/\b(node|iojs|electron)(\.exe)?$/.test(__classPrivateFieldGet(this, _YargsInstance_shim, "f").process.argv()[0])) {
        default$0 = __classPrivateFieldGet(this, _YargsInstance_shim, "f").process.argv().slice(1, 2);
      } else {
        default$0 = __classPrivateFieldGet(this, _YargsInstance_shim, "f").process.argv().slice(0, 1);
      }
      $0 = default$0.map((x) => {
        const b = this[kRebase](__classPrivateFieldGet(this, _YargsInstance_cwd, "f"), x);
        return x.match(/^(\/|([a-zA-Z]:)?\\)/) && b.length < x.length ? b : x;
      }).join(" ").trim();
      if (__classPrivateFieldGet(this, _YargsInstance_shim, "f").getEnv("_") && __classPrivateFieldGet(this, _YargsInstance_shim, "f").getProcessArgvBin() === __classPrivateFieldGet(this, _YargsInstance_shim, "f").getEnv("_")) {
        $0 = __classPrivateFieldGet(this, _YargsInstance_shim, "f").getEnv("_").replace(`${__classPrivateFieldGet(this, _YargsInstance_shim, "f").path.dirname(__classPrivateFieldGet(this, _YargsInstance_shim, "f").process.execPath())}/`, "");
      }
      return $0;
    }
    [kGetParserConfiguration]() {
      return __classPrivateFieldGet(this, _YargsInstance_parserConfig, "f");
    }
    [kGetUsageConfiguration]() {
      return __classPrivateFieldGet(this, _YargsInstance_usageConfig, "f");
    }
    [kGuessLocale]() {
      if (!__classPrivateFieldGet(this, _YargsInstance_detectLocale, "f"))
        return;
      const locale = __classPrivateFieldGet(this, _YargsInstance_shim, "f").getEnv("LC_ALL") || __classPrivateFieldGet(this, _YargsInstance_shim, "f").getEnv("LC_MESSAGES") || __classPrivateFieldGet(this, _YargsInstance_shim, "f").getEnv("LANG") || __classPrivateFieldGet(this, _YargsInstance_shim, "f").getEnv("LANGUAGE") || "en_US";
      this.locale(locale.replace(/[.:].*/, ""));
    }
    [kGuessVersion]() {
      const obj = this[kPkgUp]();
      return obj.version || "unknown";
    }
    [kParsePositionalNumbers](argv) {
      const args = argv["--"] ? argv["--"] : argv._;
      for (let i = 0, arg;(arg = args[i]) !== undefined; i++) {
        if (__classPrivateFieldGet(this, _YargsInstance_shim, "f").Parser.looksLikeNumber(arg) && Number.isSafeInteger(Math.floor(parseFloat(`${arg}`)))) {
          args[i] = Number(arg);
        }
      }
      return argv;
    }
    [kPkgUp](rootPath) {
      const npath = rootPath || "*";
      if (__classPrivateFieldGet(this, _YargsInstance_pkgs, "f")[npath])
        return __classPrivateFieldGet(this, _YargsInstance_pkgs, "f")[npath];
      let obj = {};
      try {
        let startDir = rootPath || __classPrivateFieldGet(this, _YargsInstance_shim, "f").mainFilename;
        if (!rootPath && __classPrivateFieldGet(this, _YargsInstance_shim, "f").path.extname(startDir)) {
          startDir = __classPrivateFieldGet(this, _YargsInstance_shim, "f").path.dirname(startDir);
        }
        const pkgJsonPath = __classPrivateFieldGet(this, _YargsInstance_shim, "f").findUp(startDir, (dir, names) => {
          if (names.includes("package.json")) {
            return "package.json";
          } else {
            return;
          }
        });
        assertNotStrictEqual(pkgJsonPath, undefined, __classPrivateFieldGet(this, _YargsInstance_shim, "f"));
        obj = JSON.parse(__classPrivateFieldGet(this, _YargsInstance_shim, "f").readFileSync(pkgJsonPath, "utf8"));
      } catch (_noop) {}
      __classPrivateFieldGet(this, _YargsInstance_pkgs, "f")[npath] = obj || {};
      return __classPrivateFieldGet(this, _YargsInstance_pkgs, "f")[npath];
    }
    [kPopulateParserHintArray](type, keys) {
      keys = [].concat(keys);
      keys.forEach((key) => {
        key = this[kSanitizeKey](key);
        __classPrivateFieldGet(this, _YargsInstance_options, "f")[type].push(key);
      });
    }
    [kPopulateParserHintSingleValueDictionary](builder, type, key, value) {
      this[kPopulateParserHintDictionary](builder, type, key, value, (type2, key2, value2) => {
        __classPrivateFieldGet(this, _YargsInstance_options, "f")[type2][key2] = value2;
      });
    }
    [kPopulateParserHintArrayDictionary](builder, type, key, value) {
      this[kPopulateParserHintDictionary](builder, type, key, value, (type2, key2, value2) => {
        __classPrivateFieldGet(this, _YargsInstance_options, "f")[type2][key2] = (__classPrivateFieldGet(this, _YargsInstance_options, "f")[type2][key2] || []).concat(value2);
      });
    }
    [kPopulateParserHintDictionary](builder, type, key, value, singleKeyHandler) {
      if (Array.isArray(key)) {
        key.forEach((k) => {
          builder(k, value);
        });
      } else if (((key2) => typeof key2 === "object")(key)) {
        for (const k of objectKeys(key)) {
          builder(k, key[k]);
        }
      } else {
        singleKeyHandler(type, this[kSanitizeKey](key), value);
      }
    }
    [kSanitizeKey](key) {
      if (key === "__proto__")
        return "___proto___";
      return key;
    }
    [kSetKey](key, set) {
      this[kPopulateParserHintSingleValueDictionary](this[kSetKey].bind(this), "key", key, set);
      return this;
    }
    [kUnfreeze]() {
      var _a2, _b2, _c2, _d, _e, _f, _g, _h, _j, _k, _l, _m;
      const frozen = __classPrivateFieldGet(this, _YargsInstance_frozens, "f").pop();
      assertNotStrictEqual(frozen, undefined, __classPrivateFieldGet(this, _YargsInstance_shim, "f"));
      let configObjects;
      _a2 = this, _b2 = this, _c2 = this, _d = this, _e = this, _f = this, _g = this, _h = this, _j = this, _k = this, _l = this, _m = this, {
        options: { set value(_o) {
          __classPrivateFieldSet(_a2, _YargsInstance_options, _o, "f");
        } }.value,
        configObjects,
        exitProcess: { set value(_o) {
          __classPrivateFieldSet(_b2, _YargsInstance_exitProcess, _o, "f");
        } }.value,
        groups: { set value(_o) {
          __classPrivateFieldSet(_c2, _YargsInstance_groups, _o, "f");
        } }.value,
        output: { set value(_o) {
          __classPrivateFieldSet(_d, _YargsInstance_output, _o, "f");
        } }.value,
        exitError: { set value(_o) {
          __classPrivateFieldSet(_e, _YargsInstance_exitError, _o, "f");
        } }.value,
        hasOutput: { set value(_o) {
          __classPrivateFieldSet(_f, _YargsInstance_hasOutput, _o, "f");
        } }.value,
        parsed: this.parsed,
        strict: { set value(_o) {
          __classPrivateFieldSet(_g, _YargsInstance_strict, _o, "f");
        } }.value,
        strictCommands: { set value(_o) {
          __classPrivateFieldSet(_h, _YargsInstance_strictCommands, _o, "f");
        } }.value,
        strictOptions: { set value(_o) {
          __classPrivateFieldSet(_j, _YargsInstance_strictOptions, _o, "f");
        } }.value,
        completionCommand: { set value(_o) {
          __classPrivateFieldSet(_k, _YargsInstance_completionCommand, _o, "f");
        } }.value,
        parseFn: { set value(_o) {
          __classPrivateFieldSet(_l, _YargsInstance_parseFn, _o, "f");
        } }.value,
        parseContext: { set value(_o) {
          __classPrivateFieldSet(_m, _YargsInstance_parseContext, _o, "f");
        } }.value
      } = frozen;
      __classPrivateFieldGet(this, _YargsInstance_options, "f").configObjects = configObjects;
      __classPrivateFieldGet(this, _YargsInstance_usage, "f").unfreeze();
      __classPrivateFieldGet(this, _YargsInstance_validation, "f").unfreeze();
      __classPrivateFieldGet(this, _YargsInstance_command, "f").unfreeze();
      __classPrivateFieldGet(this, _YargsInstance_globalMiddleware, "f").unfreeze();
    }
    [kValidateAsync](validation2, argv) {
      return maybeAsyncResult(argv, (result) => {
        validation2(result);
        return result;
      });
    }
    getInternalMethods() {
      return {
        getCommandInstance: this[kGetCommandInstance].bind(this),
        getContext: this[kGetContext].bind(this),
        getHasOutput: this[kGetHasOutput].bind(this),
        getLoggerInstance: this[kGetLoggerInstance].bind(this),
        getParseContext: this[kGetParseContext].bind(this),
        getParserConfiguration: this[kGetParserConfiguration].bind(this),
        getUsageConfiguration: this[kGetUsageConfiguration].bind(this),
        getUsageInstance: this[kGetUsageInstance].bind(this),
        getValidationInstance: this[kGetValidationInstance].bind(this),
        hasParseCallback: this[kHasParseCallback].bind(this),
        isGlobalContext: this[kIsGlobalContext].bind(this),
        postProcess: this[kPostProcess].bind(this),
        reset: this[kReset].bind(this),
        runValidation: this[kRunValidation].bind(this),
        runYargsParserAndExecuteCommands: this[kRunYargsParserAndExecuteCommands].bind(this),
        setHasOutput: this[kSetHasOutput].bind(this)
      };
    }
    [kGetCommandInstance]() {
      return __classPrivateFieldGet(this, _YargsInstance_command, "f");
    }
    [kGetContext]() {
      return __classPrivateFieldGet(this, _YargsInstance_context, "f");
    }
    [kGetHasOutput]() {
      return __classPrivateFieldGet(this, _YargsInstance_hasOutput, "f");
    }
    [kGetLoggerInstance]() {
      return __classPrivateFieldGet(this, _YargsInstance_logger, "f");
    }
    [kGetParseContext]() {
      return __classPrivateFieldGet(this, _YargsInstance_parseContext, "f") || {};
    }
    [kGetUsageInstance]() {
      return __classPrivateFieldGet(this, _YargsInstance_usage, "f");
    }
    [kGetValidationInstance]() {
      return __classPrivateFieldGet(this, _YargsInstance_validation, "f");
    }
    [kHasParseCallback]() {
      return !!__classPrivateFieldGet(this, _YargsInstance_parseFn, "f");
    }
    [kIsGlobalContext]() {
      return __classPrivateFieldGet(this, _YargsInstance_isGlobalContext, "f");
    }
    [kPostProcess](argv, populateDoubleDash, calledFromCommand, runGlobalMiddleware) {
      if (calledFromCommand)
        return argv;
      if (isPromise(argv))
        return argv;
      if (!populateDoubleDash) {
        argv = this[kCopyDoubleDash](argv);
      }
      const parsePositionalNumbers = this[kGetParserConfiguration]()["parse-positional-numbers"] || this[kGetParserConfiguration]()["parse-positional-numbers"] === undefined;
      if (parsePositionalNumbers) {
        argv = this[kParsePositionalNumbers](argv);
      }
      if (runGlobalMiddleware) {
        argv = applyMiddleware(argv, this, __classPrivateFieldGet(this, _YargsInstance_globalMiddleware, "f").getMiddleware(), false);
      }
      return argv;
    }
    [kReset](aliases = {}) {
      __classPrivateFieldSet(this, _YargsInstance_options, __classPrivateFieldGet(this, _YargsInstance_options, "f") || {}, "f");
      const tmpOptions = {};
      tmpOptions.local = __classPrivateFieldGet(this, _YargsInstance_options, "f").local || [];
      tmpOptions.configObjects = __classPrivateFieldGet(this, _YargsInstance_options, "f").configObjects || [];
      const localLookup = {};
      tmpOptions.local.forEach((l) => {
        localLookup[l] = true;
        (aliases[l] || []).forEach((a) => {
          localLookup[a] = true;
        });
      });
      Object.assign(__classPrivateFieldGet(this, _YargsInstance_preservedGroups, "f"), Object.keys(__classPrivateFieldGet(this, _YargsInstance_groups, "f")).reduce((acc, groupName) => {
        const keys = __classPrivateFieldGet(this, _YargsInstance_groups, "f")[groupName].filter((key) => !(key in localLookup));
        if (keys.length > 0) {
          acc[groupName] = keys;
        }
        return acc;
      }, {}));
      __classPrivateFieldSet(this, _YargsInstance_groups, {}, "f");
      const arrayOptions = [
        "array",
        "boolean",
        "string",
        "skipValidation",
        "count",
        "normalize",
        "number",
        "hiddenOptions"
      ];
      const objectOptions = [
        "narg",
        "key",
        "alias",
        "default",
        "defaultDescription",
        "config",
        "choices",
        "demandedOptions",
        "demandedCommands",
        "deprecatedOptions"
      ];
      arrayOptions.forEach((k) => {
        tmpOptions[k] = (__classPrivateFieldGet(this, _YargsInstance_options, "f")[k] || []).filter((k2) => !localLookup[k2]);
      });
      objectOptions.forEach((k) => {
        tmpOptions[k] = objFilter(__classPrivateFieldGet(this, _YargsInstance_options, "f")[k], (k2) => !localLookup[k2]);
      });
      tmpOptions.envPrefix = __classPrivateFieldGet(this, _YargsInstance_options, "f").envPrefix;
      __classPrivateFieldSet(this, _YargsInstance_options, tmpOptions, "f");
      __classPrivateFieldSet(this, _YargsInstance_usage, __classPrivateFieldGet(this, _YargsInstance_usage, "f") ? __classPrivateFieldGet(this, _YargsInstance_usage, "f").reset(localLookup) : usage(this, __classPrivateFieldGet(this, _YargsInstance_shim, "f")), "f");
      __classPrivateFieldSet(this, _YargsInstance_validation, __classPrivateFieldGet(this, _YargsInstance_validation, "f") ? __classPrivateFieldGet(this, _YargsInstance_validation, "f").reset(localLookup) : validation(this, __classPrivateFieldGet(this, _YargsInstance_usage, "f"), __classPrivateFieldGet(this, _YargsInstance_shim, "f")), "f");
      __classPrivateFieldSet(this, _YargsInstance_command, __classPrivateFieldGet(this, _YargsInstance_command, "f") ? __classPrivateFieldGet(this, _YargsInstance_command, "f").reset() : command(__classPrivateFieldGet(this, _YargsInstance_usage, "f"), __classPrivateFieldGet(this, _YargsInstance_validation, "f"), __classPrivateFieldGet(this, _YargsInstance_globalMiddleware, "f"), __classPrivateFieldGet(this, _YargsInstance_shim, "f")), "f");
      if (!__classPrivateFieldGet(this, _YargsInstance_completion, "f"))
        __classPrivateFieldSet(this, _YargsInstance_completion, completion(this, __classPrivateFieldGet(this, _YargsInstance_usage, "f"), __classPrivateFieldGet(this, _YargsInstance_command, "f"), __classPrivateFieldGet(this, _YargsInstance_shim, "f")), "f");
      __classPrivateFieldGet(this, _YargsInstance_globalMiddleware, "f").reset();
      __classPrivateFieldSet(this, _YargsInstance_completionCommand, null, "f");
      __classPrivateFieldSet(this, _YargsInstance_output, "", "f");
      __classPrivateFieldSet(this, _YargsInstance_exitError, null, "f");
      __classPrivateFieldSet(this, _YargsInstance_hasOutput, false, "f");
      this.parsed = false;
      return this;
    }
    [kRebase](base, dir) {
      return __classPrivateFieldGet(this, _YargsInstance_shim, "f").path.relative(base, dir);
    }
    [kRunYargsParserAndExecuteCommands](args, shortCircuit, calledFromCommand, commandIndex = 0, helpOnly = false) {
      let skipValidation = !!calledFromCommand || helpOnly;
      args = args || __classPrivateFieldGet(this, _YargsInstance_processArgs, "f");
      __classPrivateFieldGet(this, _YargsInstance_options, "f").__ = __classPrivateFieldGet(this, _YargsInstance_shim, "f").y18n.__;
      __classPrivateFieldGet(this, _YargsInstance_options, "f").configuration = this[kGetParserConfiguration]();
      const populateDoubleDash = !!__classPrivateFieldGet(this, _YargsInstance_options, "f").configuration["populate--"];
      const config = Object.assign({}, __classPrivateFieldGet(this, _YargsInstance_options, "f").configuration, {
        "populate--": true
      });
      const parsed = __classPrivateFieldGet(this, _YargsInstance_shim, "f").Parser.detailed(args, Object.assign({}, __classPrivateFieldGet(this, _YargsInstance_options, "f"), {
        configuration: { "parse-positional-numbers": false, ...config }
      }));
      const argv = Object.assign(parsed.argv, __classPrivateFieldGet(this, _YargsInstance_parseContext, "f"));
      let argvPromise = undefined;
      const aliases = parsed.aliases;
      let helpOptSet = false;
      let versionOptSet = false;
      Object.keys(argv).forEach((key) => {
        if (key === __classPrivateFieldGet(this, _YargsInstance_helpOpt, "f") && argv[key]) {
          helpOptSet = true;
        } else if (key === __classPrivateFieldGet(this, _YargsInstance_versionOpt, "f") && argv[key]) {
          versionOptSet = true;
        }
      });
      argv.$0 = this.$0;
      this.parsed = parsed;
      if (commandIndex === 0) {
        __classPrivateFieldGet(this, _YargsInstance_usage, "f").clearCachedHelpMessage();
      }
      try {
        this[kGuessLocale]();
        if (shortCircuit) {
          return this[kPostProcess](argv, populateDoubleDash, !!calledFromCommand, false);
        }
        if (__classPrivateFieldGet(this, _YargsInstance_helpOpt, "f")) {
          const helpCmds = [__classPrivateFieldGet(this, _YargsInstance_helpOpt, "f")].concat(aliases[__classPrivateFieldGet(this, _YargsInstance_helpOpt, "f")] || []).filter((k) => k.length > 1);
          if (helpCmds.includes("" + argv._[argv._.length - 1])) {
            argv._.pop();
            helpOptSet = true;
          }
        }
        __classPrivateFieldSet(this, _YargsInstance_isGlobalContext, false, "f");
        const handlerKeys = __classPrivateFieldGet(this, _YargsInstance_command, "f").getCommands();
        const requestCompletions = __classPrivateFieldGet(this, _YargsInstance_completion, "f").completionKey in argv;
        const skipRecommendation = helpOptSet || requestCompletions || helpOnly;
        if (argv._.length) {
          if (handlerKeys.length) {
            let firstUnknownCommand;
            for (let i = commandIndex || 0, cmd;argv._[i] !== undefined; i++) {
              cmd = String(argv._[i]);
              if (handlerKeys.includes(cmd) && cmd !== __classPrivateFieldGet(this, _YargsInstance_completionCommand, "f")) {
                const innerArgv = __classPrivateFieldGet(this, _YargsInstance_command, "f").runCommand(cmd, this, parsed, i + 1, helpOnly, helpOptSet || versionOptSet || helpOnly);
                return this[kPostProcess](innerArgv, populateDoubleDash, !!calledFromCommand, false);
              } else if (!firstUnknownCommand && cmd !== __classPrivateFieldGet(this, _YargsInstance_completionCommand, "f")) {
                firstUnknownCommand = cmd;
                break;
              }
            }
            if (!__classPrivateFieldGet(this, _YargsInstance_command, "f").hasDefaultCommand() && __classPrivateFieldGet(this, _YargsInstance_recommendCommands, "f") && firstUnknownCommand && !skipRecommendation) {
              __classPrivateFieldGet(this, _YargsInstance_validation, "f").recommendCommands(firstUnknownCommand, handlerKeys);
            }
          }
          if (__classPrivateFieldGet(this, _YargsInstance_completionCommand, "f") && argv._.includes(__classPrivateFieldGet(this, _YargsInstance_completionCommand, "f")) && !requestCompletions) {
            if (__classPrivateFieldGet(this, _YargsInstance_exitProcess, "f"))
              setBlocking(true);
            this.showCompletionScript();
            this.exit(0);
          }
        }
        if (__classPrivateFieldGet(this, _YargsInstance_command, "f").hasDefaultCommand() && !skipRecommendation) {
          const innerArgv = __classPrivateFieldGet(this, _YargsInstance_command, "f").runCommand(null, this, parsed, 0, helpOnly, helpOptSet || versionOptSet || helpOnly);
          return this[kPostProcess](innerArgv, populateDoubleDash, !!calledFromCommand, false);
        }
        if (requestCompletions) {
          if (__classPrivateFieldGet(this, _YargsInstance_exitProcess, "f"))
            setBlocking(true);
          args = [].concat(args);
          const completionArgs = args.slice(args.indexOf(`--${__classPrivateFieldGet(this, _YargsInstance_completion, "f").completionKey}`) + 1);
          __classPrivateFieldGet(this, _YargsInstance_completion, "f").getCompletion(completionArgs, (err, completions) => {
            if (err)
              throw new YError(err.message);
            (completions || []).forEach((completion2) => {
              __classPrivateFieldGet(this, _YargsInstance_logger, "f").log(completion2);
            });
            this.exit(0);
          });
          return this[kPostProcess](argv, !populateDoubleDash, !!calledFromCommand, false);
        }
        if (!__classPrivateFieldGet(this, _YargsInstance_hasOutput, "f")) {
          if (helpOptSet) {
            if (__classPrivateFieldGet(this, _YargsInstance_exitProcess, "f"))
              setBlocking(true);
            skipValidation = true;
            this.showHelp("log");
            this.exit(0);
          } else if (versionOptSet) {
            if (__classPrivateFieldGet(this, _YargsInstance_exitProcess, "f"))
              setBlocking(true);
            skipValidation = true;
            __classPrivateFieldGet(this, _YargsInstance_usage, "f").showVersion("log");
            this.exit(0);
          }
        }
        if (!skipValidation && __classPrivateFieldGet(this, _YargsInstance_options, "f").skipValidation.length > 0) {
          skipValidation = Object.keys(argv).some((key) => __classPrivateFieldGet(this, _YargsInstance_options, "f").skipValidation.indexOf(key) >= 0 && argv[key] === true);
        }
        if (!skipValidation) {
          if (parsed.error)
            throw new YError(parsed.error.message);
          if (!requestCompletions) {
            const validation2 = this[kRunValidation](aliases, {}, parsed.error);
            if (!calledFromCommand) {
              argvPromise = applyMiddleware(argv, this, __classPrivateFieldGet(this, _YargsInstance_globalMiddleware, "f").getMiddleware(), true);
            }
            argvPromise = this[kValidateAsync](validation2, argvPromise !== null && argvPromise !== undefined ? argvPromise : argv);
            if (isPromise(argvPromise) && !calledFromCommand) {
              argvPromise = argvPromise.then(() => {
                return applyMiddleware(argv, this, __classPrivateFieldGet(this, _YargsInstance_globalMiddleware, "f").getMiddleware(), false);
              });
            }
          }
        }
      } catch (err) {
        if (err instanceof YError)
          __classPrivateFieldGet(this, _YargsInstance_usage, "f").fail(err.message, err);
        else
          throw err;
      }
      return this[kPostProcess](argvPromise !== null && argvPromise !== undefined ? argvPromise : argv, populateDoubleDash, !!calledFromCommand, true);
    }
    [kRunValidation](aliases, positionalMap, parseErrors, isDefaultCommand) {
      const demandedOptions = { ...this.getDemandedOptions() };
      return (argv) => {
        if (parseErrors)
          throw new YError(parseErrors.message);
        __classPrivateFieldGet(this, _YargsInstance_validation, "f").nonOptionCount(argv);
        __classPrivateFieldGet(this, _YargsInstance_validation, "f").requiredArguments(argv, demandedOptions);
        let failedStrictCommands = false;
        if (__classPrivateFieldGet(this, _YargsInstance_strictCommands, "f")) {
          failedStrictCommands = __classPrivateFieldGet(this, _YargsInstance_validation, "f").unknownCommands(argv);
        }
        if (__classPrivateFieldGet(this, _YargsInstance_strict, "f") && !failedStrictCommands) {
          __classPrivateFieldGet(this, _YargsInstance_validation, "f").unknownArguments(argv, aliases, positionalMap, !!isDefaultCommand);
        } else if (__classPrivateFieldGet(this, _YargsInstance_strictOptions, "f")) {
          __classPrivateFieldGet(this, _YargsInstance_validation, "f").unknownArguments(argv, aliases, {}, false, false);
        }
        __classPrivateFieldGet(this, _YargsInstance_validation, "f").limitedChoices(argv);
        __classPrivateFieldGet(this, _YargsInstance_validation, "f").implications(argv);
        __classPrivateFieldGet(this, _YargsInstance_validation, "f").conflicting(argv);
      };
    }
    [kSetHasOutput]() {
      __classPrivateFieldSet(this, _YargsInstance_hasOutput, true, "f");
    }
    [kTrackManuallySetKeys](keys) {
      if (typeof keys === "string") {
        __classPrivateFieldGet(this, _YargsInstance_options, "f").key[keys] = true;
      } else {
        for (const k of keys) {
          __classPrivateFieldGet(this, _YargsInstance_options, "f").key[k] = true;
        }
      }
    }
  };
});

// node_modules/yargs/index.mjs
var Yargs, yargs_default;
var init_yargs = __esm(() => {
  init_esm();
  init_yargs_factory();
  Yargs = YargsFactory(esm_default);
  yargs_default = Yargs;
});

// node_modules/yargs/helpers/helpers.mjs
var init_helpers = __esm(() => {
  init_apply_extends();
  init_lib2();
  init_esm();
});

// src/module/wait-until.ts
var getScheduler = () => ({
  schedule: (fn, interval) => {
    let scheduledTimer;
    const cleanUp = (timer) => {
      if (timer != null) {
        clearTimeout(timer);
      }
      scheduledTimer = undefined;
    };
    const iteration = () => {
      cleanUp(scheduledTimer);
      fn();
    };
    scheduledTimer = setTimeout(iteration, interval);
    return {
      cancel: () => cleanUp(scheduledTimer)
    };
  }
}), SCHEDULER, WAIT_FOREVER;
var init_wait_until = __esm(() => {
  SCHEDULER = getScheduler();
  WAIT_FOREVER = Number.POSITIVE_INFINITY;
});

// src/module/actions/core.ts
var core;
var init_core = __esm(() => {
  core = {
    info: console.log,
    warning: console.warn,
    error: (error) => {
      console.error(error, error.stack);
    },
    setOutput: (key, value) => {
      console.log(`(mock) Output "${key}" is set to "${value}"`);
    },
    getInput: (name, options = { required: false, trimWhitespace: true }) => {
      const variable = `INPUT_${name.replace(/ /g, "_").toUpperCase()}`;
      const value = process.env[variable] || "";
      if (options?.required && !value) {
        throw new Error(`Input required and not supplied: ${name}`);
      }
      if (options?.trimWhitespace === false) {
        return value;
      }
      return value.trim();
    }
  };
});

// src/module/actions/index.ts
var init_actions = __esm(() => {
  init_core();
});

// src/module/dedent.ts
function dedent(template, ...values) {
  let strings = Array.from(typeof template === "string" ? [template] : template);
  strings[strings.length - 1] = strings[strings.length - 1].replace(/\r?\n([\t ]*)$/, "");
  const indentLengths = strings.reduce((arr, str) => {
    const matches = str.match(/\n([\t ]+|(?!\s).)/g);
    if (matches) {
      return arr.concat(matches.map((match) => match.match(/[\t ]/g)?.length ?? 0));
    }
    return arr;
  }, []);
  if (indentLengths.length) {
    const pattern = new RegExp(`
[	 ]{${Math.min(...indentLengths)}}`, "g");
    strings = strings.map((str) => str.replace(pattern, `
`));
  }
  strings[0] = strings[0].replace(/^\r?\n/, "");
  let string = strings[0];
  values.forEach((value, i) => {
    const indentations = string.match(/(?:^|\n)( *)$/);
    const indentation = indentations ? indentations[1] : "";
    let indentedValue = value;
    if (typeof value === "string" && value.includes(`
`)) {
      indentedValue = String(value).split(`
`).map((str, i2) => {
        return i2 === 0 ? str : `${indentation}${str}`;
      }).join(`
`);
    }
    string += indentedValue + strings[i + 1];
  });
  return string;
}
// src/dependencies.ts
import * as fsSync from "node:fs";
import * as path from "node:path";
import * as process2 from "node:process";
import { Buffer as Buffer2 } from "node:buffer";
import { fileURLToPath as fileURLToPath2 } from "node:url";
var semver, import_dotenv, __filename2, __dirname3, base64, fsSyncCompat, getHomeDir = () => {
  return process2.env.HOME || process2.env.USERPROFILE || null;
};
var init_dependencies = __esm(() => {
  init_dist();
  init_yargs();
  init_helpers();
  init_wait_until();
  init_actions();
  semver = __toESM(require_semver2(), 1);
  import_dotenv = __toESM(require_main(), 1);
  String.dedent = dedent;
  Error.stackTraceLimit = 15;
  __filename2 = fileURLToPath2(import.meta.url);
  __dirname3 = path.dirname(__filename2);
  base64 = {
    encode: (data) => Buffer2.from(data).toString("base64"),
    decode: (str) => new Uint8Array(Buffer2.from(str, "base64"))
  };
  fsSyncCompat = {
    ...fsSync,
    existsSync: fsSync.existsSync,
    ensureDir: (dir) => {
      fsSync.mkdirSync(dir, { recursive: true });
    },
    ensureDirSync: (dir) => {
      fsSync.mkdirSync(dir, { recursive: true });
    },
    EOL: { LF: `
`, CRLF: `\r
` }
  };
});

// src/model/system/system.ts
import { spawn } from "node:child_process";

class System {
  static async run(command2, windowsSpecificCommand, options = { silent: false }) {
    let shell;
    let shellArgs;
    let commandToRun = command2;
    switch (process.platform) {
      case "win32":
        if (log.isVeryVerbose)
          log.debug(`The following command is run using powershell`);
        if (windowsSpecificCommand) {
          commandToRun = windowsSpecificCommand;
        }
        shell = "powershell";
        shellArgs = ["-Command", commandToRun];
        break;
      default:
        if (log.isVeryVerbose)
          log.debug(`The following command is run using sh`);
        shell = "sh";
        shellArgs = ["-c", commandToRun];
        break;
    }
    return new Promise((resolve5, reject) => {
      const proc = spawn(shell, shellArgs, {
        cwd: options.cwd,
        stdio: ["inherit", "pipe", "pipe"],
        env: options.env ? { ...process.env, ...options.env } : process.env
      });
      const runResult = { output: "", error: "" };
      proc.stdout.on("data", (chunk) => {
        const text = chunk.toString();
        runResult.output += text;
        if (!options.silent) {
          process.stdout.write(chunk);
        }
      });
      proc.stderr.on("data", (chunk) => {
        const text = chunk.toString();
        runResult.error += text;
        if (!options.silent) {
          process.stderr.write(chunk);
        }
      });
      proc.on("close", (code) => {
        const exitCode = code ?? 1;
        runResult.status = { success: exitCode === 0, code: exitCode };
        if (runResult.error !== "") {
          const errorMessage = runResult.output && options.silent ? `${runResult.error}

---

Output before the error:
${runResult.output}` : runResult.error;
          reject(new Error(errorMessage));
          return;
        }
        if (log.isVeryVerbose && options.silent) {
          const symbol = runResult.status.success ? "✅" : "⚠️";
          const truncatedOutput = runResult.output.length >= 30 ? `${runResult.output.slice(0, 27)}...` : runResult.output;
          log.debug("Command:", shell, commandToRun, symbol, {
            status: runResult.status,
            output: log.isMaxVerbose ? runResult.output : truncatedOutput
          });
        }
        resolve5(runResult);
      });
      proc.on("error", (err) => {
        reject(err);
      });
    });
  }
}
var init_system = () => {};

// src/model/action.ts
class Action {
  static get isRunningLocally() {
    return process.env.RUNNER_WORKSPACE === undefined;
  }
  static get isRunningFromSource() {
    return path.basename(__dirname3) === "model";
  }
  static get canonicalName() {
    return "unity-builder";
  }
  static get rootFolder() {
    if (Action.isRunningFromSource) {
      return path.dirname(path.dirname(path.dirname(__filename2)));
    }
    return path.dirname(path.dirname(__filename2));
  }
  static get actionFolder() {
    return `${Action.rootFolder}/dist`;
  }
  static get workspace() {
    if (Action.isRunningLocally)
      return process.cwd();
    return process.env.GITHUB_WORKSPACE;
  }
}
var init_action = __esm(() => {
  init_dependencies();
});

// src/model/unity/project/unity-project.ts
class UnityProject {
  static get libraryFolder() {
    return "Library";
  }
  static getLibraryFolder(projectPath) {
    return `${projectPath}/${UnityProject.libraryFolder}`;
  }
}
var init_unity_project = () => {};

// src/logic/unity/cache/cache-validation.ts
class CacheValidation {
  static verify(options) {
    const { projectPath, isRunningLocally } = options;
    if (isRunningLocally)
      return;
    if (!fsSyncCompat.existsSync(UnityProject.getLibraryFolder(projectPath))) {
      log.warning(String.dedent`
        Library folder does not exist.

        Consider setting up caching to speed up your workflow if this is not your first build.
      `);
    }
  }
}
var init_cache_validation = __esm(() => {
  init_dependencies();
  init_unity_project();
});

// src/model/image-environment-factory.ts
class ImageEnvironmentFactory {
  static getEnvVarString(options, extraVariables = []) {
    const { hostOS } = options;
    const environmentVariables = ImageEnvironmentFactory.getEnvironmentVariables(options, extraVariables);
    const lineContinuation = hostOS === "windows" ? "`" : "\\";
    const lines = [];
    for (const p of environmentVariables) {
      if (p.value === "" || p.value === undefined) {
        continue;
      }
      if (p.name !== "ANDROID_KEYSTORE_BASE64" && p.value.toString().includes(`
`)) {
        lines.push(`--env ${p.name}`);
        continue;
      }
      if (hostOS === "windows") {
        const escapedValue = typeof p.value !== "string" ? p.value : p.value?.replace(/&/, "\\\"&\\\"");
        lines.push(`--env ${p.name}='${escapedValue}'`);
      } else {
        lines.push(`--env ${p.name}="${p.value}"`);
      }
    }
    return lines.join(` ${lineContinuation}
`);
  }
  static getEnvironmentVariables(options, extraVariables = []) {
    const environmentVariables = [
      ...extraVariables,
      { name: "PROJECT_PATH", value: options.projectPath },
      { name: "BUILD_TARGET", value: options.targetPlatform },
      { name: "BUILD_NAME", value: options.buildName },
      { name: "BUILD_PATH", value: options.buildPath },
      { name: "BUILD_FILE", value: options.buildFile },
      { name: "BUILD_METHOD", value: options.buildMethod },
      { name: "VERSION", value: options.buildVersion },
      { name: "CUSTOM_PARAMETERS", value: options.customParameters },
      { name: "CHOWN_FILES_TO", value: options.chownFilesTo },
      { name: "GITHUB_REF", value: process.env.GITHUB_REF },
      { name: "GITHUB_SHA", value: process.env.GITHUB_SHA },
      { name: "GITHUB_REPOSITORY", value: process.env.GITHUB_REPOSITORY },
      { name: "GITHUB_ACTOR", value: process.env.GITHUB_ACTOR },
      { name: "GITHUB_WORKFLOW", value: process.env.GITHUB_WORKFLOW },
      { name: "GITHUB_HEAD_REF", value: process.env.GITHUB_HEAD_REF },
      { name: "GITHUB_BASE_REF", value: process.env.GITHUB_BASE_REF },
      { name: "GITHUB_EVENT_NAME", value: process.env.GITHUB_EVENT_NAME },
      { name: "GITHUB_ACTION", value: process.env.GITHUB_ACTION },
      { name: "GITHUB_EVENT_PATH", value: process.env.GITHUB_EVENT_PATH },
      { name: "RUNNER_OS", value: process.env.RUNNER_OS },
      { name: "RUNNER_TOOL_CACHE", value: process.env.RUNNER_TOOL_CACHE },
      { name: "RUNNER_TEMP", value: process.env.RUNNER_TEMP },
      { name: "RUNNER_WORKSPACE", value: process.env.RUNNER_WORKSPACE }
    ];
    if (options.sshAgent)
      environmentVariables.push({ name: "SSH_AUTH_SOCK", value: "/ssh-agent" });
    return environmentVariables;
  }
}
var init_image_environment_factory = () => {};

// src/model/unity/build-validation/unity-build-validation.ts
class UnityBuildValidation {
  static validateBuild(buildOutput) {
    const match = buildOutput.match(/^#\s*Build results\s*#(.*)^Size:/ms);
    if (match) {
      const buildResults = match[1];
      const errorMatch = buildResults.match(/^Errors:\s*(\d+)$/m);
      if (errorMatch && Number.parseInt(errorMatch[1], 10) !== 0) {
        throw new Error(`There was an error building the project. Please read the logs for details.`);
      }
    } else {
      throw new Error(`There was an error building the project. Please read the logs for details.`);
    }
  }
}
var init_unity_build_validation = () => {};

// src/logic/unity/environment.ts
var UnityEnvironment;
var init_environment = __esm(() => {
  UnityEnvironment = {
    getVariables(options) {
      return [
        { name: "UNITY_LICENSE", value: options.unityLicense },
        { name: "UNITY_LICENSE_FILE", value: options.unityLicenseFile },
        { name: "UNITY_EMAIL", value: options.unityEmail },
        { name: "UNITY_PASSWORD", value: options.unityPassword },
        { name: "UNITY_SERIAL", value: options.unitySerial },
        { name: "UNITY_LICENSING_SERVER", value: options.unityLicensingServer },
        { name: "UNITY_VERSION", value: options.engineVersion },
        { name: "USYM_UPLOAD_AUTH_TOKEN", value: options.uploadAuthToken },
        { name: "ANDROID_VERSION_CODE", value: options.androidVersionCode },
        { name: "ANDROID_KEYSTORE_NAME", value: options.androidKeystoreName },
        { name: "ANDROID_KEYSTORE_BASE64", value: options.androidKeystoreBase64 },
        { name: "ANDROID_KEYSTORE_PASS", value: options.androidKeystorePass },
        { name: "ANDROID_KEYALIAS_NAME", value: options.androidKeyaliasName },
        { name: "ANDROID_KEYALIAS_PASS", value: options.androidKeyaliasPass },
        { name: "ANDROID_TARGET_SDK_VERSION", value: options.androidTargetSdkVersion },
        { name: "ANDROID_SDK_MANAGER_PARAMETERS", value: options.androidSdkManagerParameters },
        { name: "ANDROID_EXPORT_TYPE", value: options.androidExportType },
        { name: "ANDROID_SYMBOL_TYPE", value: options.androidSymbolType },
        { name: "MANUAL_EXIT", value: options.manualExit ? "true" : "" },
        { name: "BUILD_PROFILE", value: options.buildProfile },
        { name: "SKIP_ACTIVATION", value: options.skipActivation ? "true" : "" },
        { name: "RUN_AS_HOST_USER", value: options.runAsHostUser ? "true" : "" },
        { name: "ENABLE_GPU", value: options.enableGpu ? "true" : "" },
        { name: "GIT_CONFIG_EXTENSIONS", value: options.gitConfigExtensions }
      ];
    }
  };
});

// src/model/docker.ts
function engineEnvVars(options) {
  return options.engine === "unity" ? UnityEnvironment.getVariables(options) : [];
}

class Docker {
  static async run(image, options) {
    const { hostPlatform, hostOS, engine } = options;
    log.warning(`running docker process for ${hostOS} (${hostPlatform})`);
    let command2 = "";
    switch (hostOS) {
      case "windows": {
        command2 = await this.getWindowsCommand(image, options);
        break;
      }
      case "linux":
      case "darwin": {
        command2 = await this.getLinuxCommand(image, options);
        break;
      }
    }
    try {
      if (log.isVeryVerbose)
        log.debug(`docker command: ${command2}`);
      const dockerRun = await System.run(command2);
      switch (engine) {
        case "unity":
          UnityBuildValidation.validateBuild(dockerRun.output);
          break;
      }
    } catch (error) {
      if (error.message.includes('docker: image operating system "windows" cannot be used on this platform')) {
        throw new Error(String.dedent`
          Docker daemon is not set to run Windows containers.

          To enable the Hyper-V container backend run:
            Enable-WindowsOptionalFeature -Online -FeatureName $("Microsoft-Hyper-V", "Containers") -All

          To switch the docker daemon to run Windows containers run:
            & $Env:ProgramFiles\\Docker\\Docker\\DockerCli.exe -SwitchDaemon .

          For more information see:
            https://docs.microsoft.com/en-us/virtualization/windowscontainers/quick-start/set-up-environment?tabs=dockerce#prerequisites
        `);
      }
      throw error;
    }
  }
  static getLinuxCommand(image, options) {
    const {
      currentWorkDir,
      homeDir,
      cliDistPath,
      runnerTempPath,
      sshAgent,
      sshPublicKeysDirectoryPath,
      gitPrivateToken,
      dockerWorkspacePath,
      commands,
      engine,
      useHostNetwork,
      dockerCpuLimit,
      dockerMemoryLimit
    } = options;
    const home = homeDir;
    const envVarString = ImageEnvironmentFactory.getEnvVarString(options, engineEnvVars(options)).replace(/ \\\n/g, " ");
    const isUnityDefaultFlow = !commands || engine === "unity";
    return [
      "docker run",
      "--rm",
      `--workdir ${dockerWorkspacePath}`,
      envVarString,
      isUnityDefaultFlow ? "--env UNITY_SERIAL" : "",
      `--env GITHUB_WORKSPACE=${dockerWorkspacePath}`,
      gitPrivateToken ? `--env GIT_PRIVATE_TOKEN="${gitPrivateToken}"` : "",
      sshAgent ? "--env SSH_AUTH_SOCK=/ssh-agent" : "",
      dockerCpuLimit ? `--cpus=${dockerCpuLimit}` : "",
      dockerMemoryLimit ? `--memory=${dockerMemoryLimit}` : "",
      useHostNetwork ? "--net=host" : "",
      `--volume "${home}":"/root:z"`,
      `--volume "${currentWorkDir}":"${dockerWorkspacePath}:z"`,
      isUnityDefaultFlow ? `--volume "${cliDistPath}/default-build-script:/UnityBuilderAction:z"` : "",
      isUnityDefaultFlow ? `--volume "${cliDistPath}/platforms/ubuntu/steps:/steps:z"` : "",
      isUnityDefaultFlow ? `--volume "${cliDistPath}/platforms/ubuntu/entrypoint.sh:/entrypoint.sh:z"` : "",
      isUnityDefaultFlow ? `--volume "${cliDistPath}/unity-config:/usr/share/unity3d/config:z"` : "",
      sshAgent ? `--volume ${sshAgent}:/ssh-agent` : "",
      sshAgent && !sshPublicKeysDirectoryPath ? "--volume /home/runner/.ssh/known_hosts:/root/.ssh/known_hosts:ro" : "",
      sshPublicKeysDirectoryPath ? `--volume ${sshPublicKeysDirectoryPath}:/root/.ssh:ro` : "",
      image,
      isUnityDefaultFlow ? "/bin/bash /entrypoint.sh" : commands
    ].filter(Boolean).join(" ");
  }
  static getWindowsCommand(image, options) {
    const {
      currentWorkDir,
      homeDir,
      cliDistPath,
      unitySerial,
      gitPrivateToken,
      cliStoragePath,
      dockerWorkspacePath,
      commands,
      engine,
      dockerCpuLimit,
      dockerMemoryLimit,
      dockerIsolationMode
    } = options;
    const isUnityDefaultFlow = !commands || engine === "unity";
    return [
      "docker run `",
      "  --rm `",
      `  --workdir="c:${dockerWorkspacePath}" \``,
      `  ${ImageEnvironmentFactory.getEnvVarString(options, engineEnvVars(options))} \``,
      isUnityDefaultFlow ? `  --env UNITY_SERIAL="${unitySerial}" \`` : "",
      `  --env GITHUB_WORKSPACE=c:${dockerWorkspacePath} \``,
      `  --env GIT_PRIVATE_TOKEN="${gitPrivateToken}" \``,
      dockerCpuLimit ? `  --cpus=${dockerCpuLimit} \`` : "",
      dockerMemoryLimit ? `  --memory=${dockerMemoryLimit} \`` : "",
      dockerIsolationMode ? `  --isolation=${dockerIsolationMode} \`` : "",
      `  --volume="${currentWorkDir}":"c:${dockerWorkspacePath}" \``,
      isUnityDefaultFlow ? `  --volume="${cliStoragePath}/registry-keys":"c:/registry-keys" \`` : "",
      isUnityDefaultFlow ? '  --volume="C:/Program Files (x86)/Microsoft Visual Studio":"C:/Program Files (x86)/Microsoft Visual Studio" `' : "",
      isUnityDefaultFlow ? '  --volume="C:/Program Files (x86)/Windows Kits":"C:/Program Files (x86)/Windows Kits" `' : "",
      isUnityDefaultFlow ? '  --volume="C:/ProgramData/Microsoft/VisualStudio":"C:/ProgramData/Microsoft/VisualStudio" `' : "",
      isUnityDefaultFlow ? `  --volume="${cliDistPath}/default-build-script":"c:/UnityBuilderAction" \`` : "",
      isUnityDefaultFlow ? `  --volume="${cliDistPath}/platforms/windows":"c:/steps" \`` : "",
      isUnityDefaultFlow ? `  --volume="${cliDistPath}/BlankProject":"c:/BlankProject" \`` : "",
      isUnityDefaultFlow ? `  --volume="${cliDistPath}/unity-config":"c:/ProgramData/Unity/config" \`` : "",
      `  ${image} \``,
      isUnityDefaultFlow ? "  powershell c:/steps/entrypoint.ps1" : `  ${commands}`
    ].filter(Boolean).join(`
`);
  }
}
var init_docker = __esm(() => {
  init_image_environment_factory();
  init_system();
  init_unity_build_validation();
  init_environment();
});

// src/model/unity/target-platform/unity-target-platform.ts
class UnityTargetPlatform {
  static Android = "Android";
  static iOS = "iOS";
  static StandaloneLinux64 = "StandaloneLinux64";
  static StandaloneOSX = "StandaloneOSX";
  static StandaloneWindows = "StandaloneWindows";
  static StandaloneWindows64 = "StandaloneWindows64";
  static Switch = "Switch";
  static tvOS = "tvOS";
  static WebGL = "WebGL";
  static WSAPlayer = "WSAPlayer";
  static XboxOne = "XboxOne";
  static PS4 = "PS4";
  static Lumin = "Lumin";
  static BJM = "BJM";
  static Stadia = "Stadia";
  static Facebook = "Facebook";
  static NoTarget = "NoTarget";
  static Test = "Test";
  static get default() {
    return UnityTargetPlatform.StandaloneWindows64;
  }
  static isWindows(platform2) {
    switch (platform2) {
      case UnityTargetPlatform.StandaloneWindows:
      case UnityTargetPlatform.StandaloneWindows64:
        return true;
      default:
        return false;
    }
  }
  static isAndroid(platform2) {
    switch (platform2) {
      case UnityTargetPlatform.Android:
        return true;
      default:
        return false;
    }
  }
  static determineBuildFileName(buildName, platform2, androidExportType, linux64RemoveExecutableExtension = false) {
    if (UnityTargetPlatform.isWindows(platform2)) {
      return `${buildName}.exe`;
    }
    if (UnityTargetPlatform.isAndroid(platform2)) {
      switch (androidExportType) {
        case "androidPackage":
          return `${buildName}.apk`;
        case "androidAppBundle":
          return `${buildName}.aab`;
        case "androidStudioProject":
          return `${buildName}`;
      }
    }
    if (platform2 === UnityTargetPlatform.StandaloneLinux64 && !linux64RemoveExecutableExtension) {
      return `${buildName}.x86_64`;
    }
    return buildName;
  }
}
var init_unity_target_platform = () => {};

// src/model/unity/runner/runner-image-tag.ts
class RunnerImageTag {
  repository;
  name;
  engineVersion;
  targetPlatform;
  builderPlatform;
  customImage;
  imageRollingVersion;
  imagePlatformPrefix;
  constructor(options) {
    const {
      engineVersion = "2019.2.11f1",
      hostPlatform,
      targetPlatform,
      customImage,
      containerRegistryRepository = "unityci/editor",
      containerRegistryImageVersion = "3"
    } = options;
    if (!RunnerImageTag.versionPattern.test(engineVersion)) {
      throw new Error(`Invalid version "${engineVersion}".`);
    }
    const registryString = String(containerRegistryRepository);
    const lastSlashIndex = registryString.lastIndexOf("/");
    const repository = lastSlashIndex === -1 ? "unityci" : registryString.slice(0, lastSlashIndex);
    const name = lastSlashIndex === -1 ? registryString : registryString.slice(lastSlashIndex + 1);
    this.customImage = customImage;
    this.repository = repository;
    this.name = name;
    this.engineVersion = engineVersion;
    this.targetPlatform = targetPlatform;
    this.imagePlatformPrefix = RunnerImageTag.getImagePlatformPrefixes(hostPlatform);
    this.builderPlatform = RunnerImageTag.getTargetPlatformToTargetPlatformSuffixMap(hostPlatform, targetPlatform, engineVersion);
    this.imageRollingVersion = Number(containerRegistryImageVersion);
  }
  static get versionPattern() {
    return /^20\d{2}\.\d\.\w{3,4}|3$/;
  }
  static get targetPlatformSuffixes() {
    return {
      generic: "",
      webgl: "webgl",
      mac: "mac-mono",
      windows: "windows-mono",
      windowsIl2cpp: "windows-il2cpp",
      wsaPlayer: "universal-windows-platform",
      linux: "base",
      linuxIl2cpp: "linux-il2cpp",
      android: "android",
      ios: "ios",
      tvos: "appletv",
      facebook: "facebook"
    };
  }
  static getImagePlatformPrefixes(platform2) {
    switch (platform2) {
      case "win32":
        return "windows";
      case "linux":
        return "ubuntu";
      default:
        return "";
    }
  }
  static getTargetPlatformToTargetPlatformSuffixMap(hostPlatform, targetPlatform, version) {
    log.info(hostPlatform, targetPlatform, version);
    const { generic, webgl, mac, windows, windowsIl2cpp, wsaPlayer, linux, linuxIl2cpp, android, ios, tvos, facebook } = RunnerImageTag.targetPlatformSuffixes;
    const [major, minor] = version.split(".").map(Number);
    switch (targetPlatform) {
      case UnityTargetPlatform.StandaloneOSX:
        return mac;
      case UnityTargetPlatform.StandaloneWindows:
      case UnityTargetPlatform.StandaloneWindows64:
        if (hostPlatform === "win32") {
          if (major >= 2020 || major === 2019 && minor >= 3) {
            return windowsIl2cpp;
          } else {
            throw new Error(`Windows-based builds are only supported on 2019.3.X+ versions of Unity.
                             If you are trying to build for windows-mono, please use a Linux based OS.`);
          }
        }
        return windows;
      case UnityTargetPlatform.StandaloneLinux64: {
        if (major >= 2020 || major === 2019 && minor >= 3) {
          return linuxIl2cpp;
        }
        return linux;
      }
      case UnityTargetPlatform.iOS:
        return ios;
      case UnityTargetPlatform.Android:
        return android;
      case UnityTargetPlatform.WebGL:
        return webgl;
      case UnityTargetPlatform.WSAPlayer:
        if (hostPlatform !== "win32") {
          throw new Error(`WSAPlayer can only be built on a windows base OS`);
        }
        return wsaPlayer;
      case UnityTargetPlatform.PS4:
        return windows;
      case UnityTargetPlatform.XboxOne:
        return windows;
      case UnityTargetPlatform.tvOS:
        if (hostPlatform !== "win32") {
          throw new Error(`tvOS can only be built on a windows base OS`);
        }
        return tvos;
      case UnityTargetPlatform.Switch:
        return windows;
      case UnityTargetPlatform.Lumin:
        return windows;
      case UnityTargetPlatform.BJM:
        return windows;
      case UnityTargetPlatform.Stadia:
        return windows;
      case UnityTargetPlatform.Facebook:
        return facebook;
      case UnityTargetPlatform.NoTarget:
        return generic;
      case UnityTargetPlatform.Test:
        return generic;
      default:
        throw new Error(`
          Platform must be one of the ones described in the documentation.
          "${targetPlatform}" is currently not supported.`);
    }
  }
  get tag() {
    const versionAndPlatform = `${this.engineVersion}-${this.builderPlatform}`.replace(/-+$/, "");
    return `${this.imagePlatformPrefix}-${versionAndPlatform}-${this.imageRollingVersion}`;
  }
  get image() {
    return `${this.repository}/${this.name}`.replace(/^\/+/, "");
  }
  toString() {
    const { image, tag, customImage } = this;
    if (customImage)
      return customImage;
    return `${image}:${tag}`;
  }
}
var init_runner_image_tag = __esm(() => {
  init_unity_target_platform();
});

// src/model/output.ts
class Output {
  static setBuildVersion(buildVersion) {
    core.setOutput("buildVersion", buildVersion);
  }
  static setAndroidVersionCode(androidVersionCode) {
    core.setOutput("androidVersionCode", androidVersionCode);
  }
}
var init_output = __esm(() => {
  init_dependencies();
});

// src/model/error/not-implemented-exception.ts
var NotImplementedException;
var init_not_implemented_exception = __esm(() => {
  NotImplementedException = class NotImplementedException extends Error {
    constructor(message = "") {
      super(message);
      this.name = "NotImplementedException";
    }
  };
});

// src/model/versioning/versioning-strategy.ts
class VersioningStrategy {
  static None = "None";
  static Semantic = "Semantic";
  static Tag = "Tag";
  static Custom = "Custom";
}

// src/middleware/build-versioning/build-version-generator.ts
class BuildVersionGenerator {
  maxDiffLines = 60;
  projectPath;
  currentBranch;
  constructor(projectPath, currentBranch) {
    this.projectPath = projectPath;
    this.currentBranch = currentBranch;
  }
  async determineBuildVersion(strategy, inputVersion, allowDirtyBuild) {
    log.info("Versioning strategy:", strategy);
    let version;
    switch (strategy) {
      case VersioningStrategy.None:
        version = "none";
        break;
      case VersioningStrategy.Custom:
        version = inputVersion;
        break;
      case VersioningStrategy.Semantic:
        version = await this.generateSemanticVersion(allowDirtyBuild);
        break;
      case VersioningStrategy.Tag:
        version = await this.generateTagVersion();
        break;
      default:
        throw new NotImplementedException(`Strategy ${strategy} is not implemented.`);
    }
    log.info("Version of this build:", version);
    return version;
  }
  get grepCompatibleInputVersionRegex() {
    return "^v?([0-9]+\\.)*[0-9]+.*";
  }
  get sha() {
    return process.env.GITHUB_SHA;
  }
  get descriptionRegex1() {
    return /^v?([\d.]+)-(\d+)-g(\w+)-?(\w+)*/g;
  }
  get descriptionRegex2() {
    return /^v?([\d.]+-\w+)-(\d+)-g(\w+)-?(\w+)*/g;
  }
  get descriptionRegex3() {
    return /^v?([\d.]+-\w+\.\d+)-(\d+)-g(\w+)-?(\w+)*/g;
  }
  async logDiff() {
    const diffCommand = `git --no-pager diff | head -n ${this.maxDiffLines.toString()}`;
    const result = await System.run(diffCommand);
    log.debug(result.output);
  }
  async generateSemanticVersion(allowDirtyBuild) {
    if (await this.isShallow()) {
      await this.fetch();
    }
    if (await this.isDirty() && !allowDirtyBuild) {
      await this.logDiff();
      throw new Error("Branch is dirty. Refusing to base semantic version on uncommitted changes");
    }
    if (!await this.hasAnyVersionTags()) {
      const version2 = `0.0.${await this.getTotalNumberOfCommits()}`;
      log.info(`Generated version ${version2} (no version tags found).`);
      return version2;
    }
    const versionDescriptor = await this.parseSemanticVersion();
    if (versionDescriptor) {
      const { tag, commits, hash } = versionDescriptor;
      const [major, minor, patch] = `${tag}.${commits}`.split(".");
      const threeDigitVersion = /^\d+$/.test(patch) ? `${major}.${minor}.${patch}` : `${major}.0.${minor}`;
      log.info(`Found semantic version ${threeDigitVersion} for ${this.currentBranch}@${hash}`);
      return `${threeDigitVersion}`;
    }
    const version = `0.0.${await this.getTotalNumberOfCommits()}`;
    log.info(`Generated version ${version} (semantic version couldn't be determined).`);
    return version;
  }
  async generateTagVersion() {
    let tag = await this.getTag();
    if (tag.charAt(0) === "v") {
      tag = tag.slice(1);
    }
    return tag;
  }
  async parseSemanticVersion() {
    const description = await this.getVersionDescription();
    try {
      const [match, tag, commits, hash] = this.descriptionRegex1.exec(description);
      return {
        match,
        tag,
        commits,
        hash
      };
    } catch {
      try {
        const [match, tag, commits, hash] = this.descriptionRegex2.exec(description);
        return {
          match,
          tag,
          commits,
          hash
        };
      } catch {
        try {
          const [match, tag, commits, hash] = this.descriptionRegex3.exec(description);
          return {
            match,
            tag,
            commits,
            hash
          };
        } catch {
          log.warning(`Failed to parse git describe output or version can not be determined through "${description}".`);
          return false;
        }
      }
    }
  }
  async isShallow() {
    const output = await this.git("rev-parse --is-shallow-repository");
    return output.trim() !== "false";
  }
  async fetch() {
    try {
      await this.git("fetch --unshallow");
    } catch {
      log.warning(`fetch --unshallow did not work, falling back to regular fetch`);
      await this.git("fetch");
    }
  }
  async getVersionDescription() {
    let commitIsh = "HEAD";
    if (!Action.isRunningLocally) {
      commitIsh = this.sha;
    }
    return this.git(`describe --long --tags --always ${commitIsh}`);
  }
  async isDirty() {
    const output = await this.git("status --porcelain");
    const isDirty = output !== "";
    if (isDirty) {
      log.warning(`Changes were made to the following files and folders:

  A = addition, M = modification, D = deletion

`, output);
    }
    return isDirty;
  }
  async getTag() {
    return await this.git("tag --points-at HEAD");
  }
  async hasAnyVersionTags() {
    const command2 = `git tag --list --merged HEAD | grep -E '${this.grepCompatibleInputVersionRegex}' | wc -l`;
    const windowsCommand = `git tag --list --merged HEAD | Select-String -Pattern "${this.grepCompatibleInputVersionRegex}" | Measure-Object | Select-Object -ExpandProperty Count`;
    const result = await System.run(command2, windowsCommand, { cwd: this.projectPath, silent: false });
    log.debug(result);
    const { output: numberOfTagsAsString } = result;
    const numberOfTags = Number.parseInt(numberOfTagsAsString, 10);
    log.debug("numberOfTags", numberOfTags);
    return numberOfTags !== 0;
  }
  async getTotalNumberOfCommits() {
    const numberOfCommitsAsString = await this.git(`rev-list --count HEAD`);
    return Number.parseInt(numberOfCommitsAsString, 10);
  }
  async git(arguments_, options = {}) {
    const result = await System.run(`git ${arguments_}`, undefined, { cwd: this.projectPath, ...options });
    log.warning(result);
    return result.output;
  }
}
var init_build_version_generator = __esm(() => {
  init_not_implemented_exception();
  init_system();
  init_model();
});

// src/model/index.ts
var exports_model = {};
__export(exports_model, {
  UnityTargetPlatform: () => UnityTargetPlatform,
  UnityProject: () => UnityProject,
  RunnerImageTag: () => RunnerImageTag,
  Output: () => Output,
  Docker: () => Docker,
  CacheValidation: () => CacheValidation,
  BuildVersionGenerator: () => BuildVersionGenerator,
  Action: () => Action
});
var init_model = __esm(() => {
  init_action();
  init_cache_validation();
  init_docker();
  init_runner_image_tag();
  init_output();
  init_unity_target_platform();
  init_unity_project();
  init_build_version_generator();
});

// src/cli.ts
init_dependencies();

// src/core/logger/index.ts
init_dependencies();
import * as nodePath from "node:path";
import * as nodeFs from "node:fs";
var Verbosity;
((Verbosity2) => {
  Verbosity2[Verbosity2["quiet"] = -1] = "quiet";
  Verbosity2[Verbosity2["normal"] = 0] = "normal";
  Verbosity2[Verbosity2["verbose"] = 1] = "verbose";
  Verbosity2[Verbosity2["veryVerbose"] = 2] = "veryVerbose";
  Verbosity2[Verbosity2["maxVerbose"] = 3] = "maxVerbose";
})(Verbosity ||= {});
var configureLogger = async (verbosity) => {
  const isQuiet = verbosity === -1 /* quiet */;
  const isVerbose = verbosity >= 1 /* verbose */;
  const isVeryVerbose = verbosity >= 2 /* veryVerbose */;
  const isMaxVerbose = verbosity >= 3 /* maxVerbose */;
  const configFolder = `${getHomeDir()}/.game-ci`;
  fsSyncCompat.ensureDir(configFolder);
  const logFilePath = nodePath.join(configFolder, "game-ci.log");
  const writeToFile = (level, msg) => {
    const now = new Date;
    const timestamp = `${now.getHours().toString().padStart(2, "0")}:${now.getMinutes().toString().padStart(2, "0")}:${now.getSeconds().toString().padStart(2, "0")}`;
    const line = `${timestamp} [${level}] ${msg}
`;
    try {
      nodeFs.appendFileSync(logFilePath, line);
    } catch {}
  };
  const formatArgs = (msg, args) => {
    const parts = [typeof msg === "string" ? msg : inspect2(msg)];
    for (const arg of args) {
      parts.push(typeof arg === "string" ? arg : inspect2(arg));
    }
    return parts.join(" ");
  };
  const inspect2 = (value) => {
    if (value === undefined)
      return "undefined";
    if (value === null)
      return "null";
    if (typeof value === "string")
      return value;
    try {
      return JSON.stringify(value, null, 2);
    } catch {
      return String(value);
    }
  };
  process.on("SIGINT", () => process.exit(130));
  const logger = {
    verbosity,
    verbosityName: Verbosity[verbosity],
    isQuiet,
    isVerbose,
    isVeryVerbose,
    isMaxVerbose,
    debug: (msg, ...args) => {
      const formatted = formatArgs(msg, args);
      writeToFile("DEBUG", formatted);
      if (isVerbose && !isQuiet)
        console.debug(`[DEBUG] ${formatted}`);
    },
    info: (msg, ...args) => {
      const formatted = formatArgs(msg, args);
      writeToFile("INFO", formatted);
      if (!isQuiet)
        console.log(`[INFO] ${formatted}`);
    },
    warning: (msg, ...args) => {
      const formatted = formatArgs(msg, args);
      writeToFile("WARNING", formatted);
      if (!isQuiet)
        console.warn(`[WARN] ${formatted}`);
    },
    error: (msg, ...args) => {
      const formatted = formatArgs(msg, args);
      writeToFile("ERROR", formatted);
      console.error(`[ERROR] ${formatted}`);
    },
    startGroup: (name) => {
      writeToFile("GROUP", name);
      if (process.env.GITHUB_ACTIONS === "true" && !isQuiet) {
        console.log(`::group::${name}`);
      } else if (!isQuiet) {
        console.log(`--- ${name} ---`);
      }
    },
    endGroup: () => {
      if (process.env.GITHUB_ACTIONS === "true" && !isQuiet) {
        console.log("::endgroup::");
      }
    },
    group: async (name, fn) => {
      logger.startGroup(name);
      try {
        return await fn();
      } finally {
        logger.endGroup();
      }
    }
  };
  globalThis.log = logger;
};

// src/middleware/logger-verbosity/index.ts
var configureLogger2 = async (argv) => {
  const { quiet, verbose, veryVerbose, maxVerbose } = argv;
  let verbosity;
  if (maxVerbose) {
    verbosity = 3;
  } else if (veryVerbose) {
    verbosity = 2;
  } else if (verbose) {
    verbosity = 1;
  } else if (quiet) {
    verbosity = -1;
  } else {
    verbosity = 0;
  }
  await configureLogger(verbosity);
  argv.logLevel = log.verbosity;
  argv.quiet = undefined;
  argv.verbose = undefined;
  argv.veryVerbose = undefined;
  argv.maxVerbose = undefined;
};

// src/command/command-base.ts
class CommandBase {
  name;
  constructor(name) {
    this.name = name.charAt(0).toUpperCase() + name.slice(1);
  }
  execute(options) {
    throw new Error("Method not implemented.");
  }
  configureOptions(yargs) {
    throw new Error("Method not implemented.");
  }
}

// src/command/null/non-existent-command.ts
class NonExistentCommand extends CommandBase {
  execute(options) {
    throw new Error(`Command "${this.name}" does not exist`);
  }
  async configureOptions(yargs) {}
}

// src/model/engine/engine.ts
class Engine {
  static unity = "unity";
  static unknown = "unknown";
}

// src/command/config/open-config-folder-command.ts
init_dependencies();
import { exec } from "node:child_process";

class OpenConfigFolderCommand extends CommandBase {
  async execute(options) {
    const cliStoragePath = `${getHomeDir()}/.game-ci`;
    const openCommand = process.platform === "win32" ? `start "" "${cliStoragePath}"` : process.platform === "darwin" ? `open "${cliStoragePath}"` : `xdg-open "${cliStoragePath}"`;
    return new Promise((resolve5) => {
      exec(openCommand, (err) => {
        if (err) {
          log.error(`Failed to open config folder: ${err.message}`);
          resolve5(false);
        } else {
          resolve5(true);
        }
      });
    });
  }
  async configureOptions(yargs) {}
}

// src/command/build-image/build-image-command.ts
init_system();

// src/model/build-image/recipe-file.ts
init_dependencies();

class RecipeFileError extends Error {
  constructor(message) {
    super(message);
    this.name = "RecipeFileError";
  }
}
var RecipeFileReader = {
  read(recipePath) {
    if (!fsSyncCompat.existsSync(recipePath)) {
      throw new RecipeFileError(`Recipe file not found: ${recipePath}`);
    }
    let parsed;
    try {
      parsed = exports_dist.parse(fsSyncCompat.readFileSync(recipePath, "utf8"));
    } catch (error) {
      throw new RecipeFileError(`Could not parse recipe file "${recipePath}": ${error.message}`);
    }
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      throw new RecipeFileError(`Recipe file "${recipePath}" must contain a YAML mapping.`);
    }
    const recipe = parsed;
    if (recipe.engine !== undefined && recipe.engine !== "unity") {
      throw new RecipeFileError(`Recipe file "${recipePath}" declares engine "${recipe.engine}", but build-unity-image only supports "unity".`);
    }
    if (typeof recipe.unityVersion !== "string" || recipe.unityVersion === "") {
      throw new RecipeFileError(`Recipe file "${recipePath}" is missing required field "unityVersion".`);
    }
    if (recipe.modules !== undefined && !Array.isArray(recipe.modules)) {
      throw new RecipeFileError(`Recipe file "${recipePath}": "modules" must be a list.`);
    }
    return {
      version: typeof recipe.version === "number" ? recipe.version : undefined,
      engine: typeof recipe.engine === "string" ? recipe.engine : undefined,
      unityVersion: recipe.unityVersion,
      baseOs: typeof recipe.baseOs === "string" ? recipe.baseOs : undefined,
      modules: Array.isArray(recipe.modules) ? recipe.modules.map(String) : undefined,
      changeset: typeof recipe.changeset === "string" ? recipe.changeset : undefined,
      hubImage: typeof recipe.hubImage === "string" ? recipe.hubImage : undefined,
      baseImage: typeof recipe.baseImage === "string" ? recipe.baseImage : undefined,
      tag: typeof recipe.tag === "string" ? recipe.tag : undefined
    };
  }
};

// src/command/build-image/build-image-command.ts
class BuildImageCommand extends CommandBase {
  async execute(options) {
    const recipePath = options.recipe;
    let recipe;
    if (recipePath) {
      try {
        recipe = RecipeFileReader.read(recipePath);
      } catch (error) {
        if (error instanceof RecipeFileError) {
          log.error(error.message);
          return false;
        }
        throw error;
      }
    }
    const baseOs = recipe?.baseOs || options.baseOs || "ubuntu";
    const modules = recipe?.modules ? recipe.modules.join(",") : options.modules || "base";
    const unityVersion = recipe?.unityVersion || options.unityVersion;
    const changeset = recipe?.changeset || options.changeset;
    const tag = recipe?.tag || options.tag;
    const push = options.push;
    const defaultHubImage = baseOs === "windows" ? "unityci/hub:windows-latest" : "unityci/hub";
    const defaultBaseImage = baseOs === "windows" ? "unityci/base:windows-latest" : "unityci/base";
    const hubImage = recipe?.hubImage || options.hubImage || defaultHubImage;
    const baseImage = recipe?.baseImage || options.baseImage || defaultBaseImage;
    if (!unityVersion) {
      log.error(recipe ? `Recipe file "${recipePath}" is missing required field "unityVersion".` : "--unity-version is required");
      return false;
    }
    let resolvedChangeset = changeset;
    if (!resolvedChangeset) {
      log.info(`Resolving changeset for Unity ${unityVersion}...`);
      try {
        const result = await System.run(`npx unity-changeset ${unityVersion}`, undefined, {
          silent: true
        });
        resolvedChangeset = result.output.trim();
        if (!resolvedChangeset)
          throw new Error("empty changeset");
        log.info(`Changeset: ${resolvedChangeset}`);
      } catch {
        log.error(`Could not resolve changeset for ${unityVersion}. Use --changeset to provide it manually.`);
        return false;
      }
    }
    const moduleSlug = modules.replace(/,/g, "-");
    const imageTag = tag || `unityci/editor:${baseOs}-${unityVersion}-${moduleSlug}`;
    const moduleArg = modules.replace(/,/g, " ");
    log.info(`Building image: ${imageTag}`);
    log.info(`  Base OS: ${baseOs}`);
    log.info(`  Modules: ${moduleArg}`);
    log.info(`  Unity: ${unityVersion}`);
    const dockerfile = generateDockerfile(baseOs);
    const dockerfilePath = `.game-ci-build-image.Dockerfile`;
    await Bun.write(dockerfilePath, dockerfile);
    try {
      const buildCmd = [
        "docker build",
        `-f "${dockerfilePath}"`,
        `--build-arg hubImage="${hubImage}"`,
        `--build-arg baseImage="${baseImage}"`,
        `--build-arg version="${unityVersion}"`,
        `--build-arg changeSet="${resolvedChangeset}"`,
        `--build-arg module="${moduleArg}"`,
        `-t "${imageTag}"`,
        "."
      ].join(" ");
      log.info(`Running: ${buildCmd}`);
      let buildFailed = false;
      await log.group(`docker build (${imageTag})`, async () => {
        try {
          await System.run(buildCmd);
        } catch (error) {
          log.error(`Docker build failed: ${error.message}`);
          buildFailed = true;
        }
      });
      if (buildFailed)
        return false;
      log.info(`Successfully built: ${imageTag}`);
      if (push) {
        log.info(`Pushing ${imageTag}...`);
        let pushFailed = false;
        await log.group(`docker push (${imageTag})`, async () => {
          try {
            await System.run(`docker push "${imageTag}"`);
          } catch (error) {
            log.error(`Docker push failed: ${error.message}`);
            pushFailed = true;
          }
        });
        if (pushFailed)
          return false;
        log.info(`Pushed: ${imageTag}`);
      }
    } finally {
      try {
        const fs = await import("node:fs");
        fs.unlinkSync(dockerfilePath);
      } catch {}
    }
    return true;
  }
  async configureOptions(yargs) {
    yargs.positional("baseOs", {
      describe: "Base operating system (ubuntu, windows)",
      type: "string",
      default: "ubuntu"
    });
    yargs.positional("modules", {
      describe: "Comma-separated Unity modules to install",
      type: "string",
      default: "base"
    });
    yargs.option("unity-version", {
      describe: "Unity editor version (e.g. 2022.3.20f1). Required unless provided via --recipe.",
      type: "string"
    });
    yargs.option("recipe", {
      describe: "Path to a declarative recipe YAML file (see docs/proposals/recipe-file-format.md). Fields in the recipe take priority over the corresponding CLI flags.",
      type: "string"
    });
    yargs.option("changeset", {
      describe: "Unity changeset hash (auto-resolved if omitted)",
      type: "string"
    });
    yargs.option("tag", {
      describe: "Docker image tag (default: unityci/editor:<baseOs>-<version>-<modules>)",
      type: "string"
    });
    yargs.option("push", {
      describe: "Push image after building",
      type: "boolean",
      default: false
    });
    yargs.option("hub-image", {
      describe: "Hub base image",
      type: "string"
    });
    yargs.option("base-image", {
      describe: "Editor base image",
      type: "string"
    });
  }
}
function generateDockerfile(baseOs) {
  if (baseOs === "windows") {
    return generateWindowsDockerfile();
  }
  return generateUbuntuDockerfile();
}
function generateUbuntuDockerfile() {
  return `ARG hubImage="unityci/hub"
ARG baseImage="unityci/base"

###########################
#         Builder         #
###########################

FROM $hubImage AS builder

# Install editor
ARG version
ARG changeSet
RUN unity-hub install --version "$version" --changeset "$changeSet" | tee /var/log/install-editor.log && grep 'Failed to install\\|Error while installing an editor\\|Completed with errors' /var/log/install-editor.log | exit $(wc -l)

# Install modules for that editor
ARG module="non-existent-module"
RUN for mod in $module; do \\
      if [ "$mod" = "base" ] ; then \\
        echo "running default modules for this baseOs"; \\
      else \\
        unity-hub install-modules --version "$version" --module "$mod" --childModules | tee /var/log/install-module-\${mod}.log && grep 'Missing module\\|Completed with errors' /var/log/install-module-\${mod}.log | exit $(wc -l); \\
      fi \\
    done \\
    # Set execute permissions for modules
    && chmod -R 755 /opt/unity/editors/$version/Editor/Data/PlaybackEngines

#=======================================================================================
# [2021.2.5+] Auto-install linux-server module when module contains "linux"
#=======================================================================================
RUN echo "$version-$module" | grep -q -vP '^(2021.2.(?![0-4](?![0-9]))|2021.[3-9]|202[2-9]|[6-9][0-9]{3}|[1-9][0-9]{4,}).*linux' \\
  && exit 0 \\
  || unity-hub install-modules --version "$version" --module "linux-server" --childModules | tee /var/log/install-module-linux-server.log && grep 'Missing module' /var/log/install-module-linux-server.log | exit $(wc -l);

#=======================================================================================
# [2021.2.5+] Auto-install windows-server module when module contains "windows"
#=======================================================================================
RUN echo "$version-$module" | grep -q -vP '^(2021.2.(?![0-4](?![0-9]))|2021.[3-9]|202[2-9]|[6-9][0-9]{3}|[1-9][0-9]{4,}).*windows' \\
  && exit 0 \\
  || unity-hub install-modules --version "$version" --module "windows-server" --childModules | tee /var/log/install-module-windows-server.log && grep 'Missing module' /var/log/install-module-windows-server.log | exit $(wc -l);

###########################
#          Editor         #
###########################

FROM $baseImage

# Always put "Editor" and "modules.json" directly in $UNITY_PATH
ARG version
ARG module
COPY --from=builder /opt/unity/editors/$version/ "$UNITY_PATH/"

# Add a file containing the version for this build
RUN echo $version > "$UNITY_PATH/version"


###########################
#  Alias to unity-editor  #
###########################

RUN /bin/echo -e '#!/bin/bash\\n\\
\\n\\
if [ -d /usr/bin/unity-editor.d ] ; then\\n\\
  for i in /usr/bin/unity-editor.d/*.sh; do\\n\\
    if [ -r $i ]; then\\n\\
      . $i\\n\\
    fi\\n\\
  done\\n\\
fi\\n\\
\\n\\
xvfb-run -ae /dev/stdout "$UNITY_PATH/Editor/Unity" -batchmode "$@"' > /usr/bin/unity-editor \\
  && chmod 755 /usr/bin/unity-editor \\
  && mkdir /usr/bin/unity-editor.d \\
  && echo > ~/.bashrc # start from empty to keep "Validate Android Utils" CI step happy.

#=======================================================================================
# [2019.3.[0-5]-linux-il2cpp] https://github.com/game-ci/docker/issues/76
#=======================================================================================
RUN echo "$version-$module" | grep -q -v '^2019.3.[0-5]f.*linux-il2cpp' \\
  && exit 0 \\
  || echo 'export IL2CPP_ADDITIONAL_ARGS=--tool-chain-path=/' >> /usr/bin/unity-editor.d/linux-il2cpp-2019.3.5.and.older.sh

#=======================================================================================
# [2019.3.6+/2019.4.0-linux-il2cpp] https://forum.unity.com/threads/unity-2019-3-linux-il2cpp-player-can-only-be-built-with-linux-error.822210/#post-5633977
#=======================================================================================
RUN echo "$version-$module" | grep -q -v '^\\(2019.3.[6-9]f\\|2019.3.1[0-9]f\\|2019.4.0\\).*linux-il2cpp' \\
  && exit 0 \\
  || echo 'export IL2CPP_ADDITIONAL_ARGS="--sysroot-path=/ --tool-chain-path=/"' >> /usr/bin/unity-editor.d/linux-il2cpp-2019.3-4.sh

#=======================================================================================
# [2020.x/2020.2.0/2020.2.1-webgl] Support GZip compression: https://github.com/game-ci/docker/issues/75
#=======================================================================================
RUN echo "$version-$module" | grep -q -v '^\\(2020.1\\|2020.2.0f\\|2020.2.1f\\).*-webgl' \\
  && exit 0 \\
  || : \\
  && wget https://old-releases.ubuntu.com/ubuntu/pool/main/g/gzip/gzip_1.6-5ubuntu2_amd64.deb \\
  && dpkg -i gzip_1.6-5ubuntu2_amd64.deb \\
  && rm gzip_1.6-5ubuntu2_amd64.deb \\
  && echo 'export GZIP=-f' >> /usr/bin/unity-editor.d/webgl-2020.1-2.sh


###########################
#       Extra steps       #
###########################

#=======================================================================================
# [2018.x-android] Install 'Android SDK 26.1.1' and 'Android NDK 16.1.4479499'
#=======================================================================================
RUN echo "$version-$module" | grep -q -v '^2018\\.[34].*android' \\
  && exit 0 \\
  || : \\
  # Versions
  && export ANDROID_BUILD_TOOLS_VERSION=28.0.3 \\
  && export ANDROID_NDK_VERSION=16.1.4479499 \\
  \\
  # Environment Variables
  && export ANDROID_INSTALL_LOCATION=\${UNITY_PATH}/Editor/Data/PlaybackEngines/AndroidPlayer \\
  && export ANDROID_SDK_ROOT=\${ANDROID_INSTALL_LOCATION}/SDK \\
  && export ANDROID_HOME=\${ANDROID_SDK_ROOT} \\
  && export ANDROID_NDK_HOME=\${ANDROID_SDK_ROOT}/ndk/\${ANDROID_NDK_VERSION} \\
  && export JAVA_HOME=\${UNITY_PATH}/Editor/Data/PlaybackEngines/AndroidPlayer/Tools/OpenJDK/Linux \\
  && export PATH=$JAVA_HOME/bin:\${ANDROID_SDK_ROOT}/tools:\${ANDROID_SDK_ROOT}/tools/bin:\${ANDROID_SDK_ROOT}/platform-tools:\${PATH} \\
  \\
  # Download Android SDK (commandline tools) 26.1.1
  && mkdir -p \${ANDROID_SDK_ROOT} \\
  && chmod -R 777 \${ANDROID_INSTALL_LOCATION} \\
  && wget -q https://dl.google.com/android/repository/sdk-tools-linux-4333796.zip -O /tmp/android-sdk.zip \\
  && unzip -q /tmp/android-sdk.zip -d \${ANDROID_SDK_ROOT} \\
  \\
  # Install platform-tools, NDK 16.1.4479499 and build-tools 28.0.3
  && yes | sdkmanager \\
    "platform-tools" \\
    "ndk;\${ANDROID_NDK_VERSION}" \\
    "build-tools;\${ANDROID_BUILD_TOOLS_VERSION}" \\
    > /dev/null \\
  \\
  # Accept licenses
  && yes | "\${ANDROID_HOME}/tools/bin/sdkmanager" --licenses \\
  \\
  # Update alias 'unity-editor'
  && { \\
    echo "export ANDROID_SDK_ROOT=\${ANDROID_SDK_ROOT}"; \\
    echo "export ANDROID_HOME=\${ANDROID_HOME}"; \\
    echo "export ANDROID_NDK_HOME=\${ANDROID_NDK_HOME}"; \\
    echo "export JAVA_HOME=\${JAVA_HOME}"; \\
    echo "export PATH=\${PATH}"; \\
  } > /usr/bin/unity-editor.d/android-2018.3-4.sh \\
  # Update '~/.bashrc' to enable using variables when logging in
  && echo ". /usr/bin/unity-editor.d/android-2018.3-4.sh" >> ~/.bashrc

#=======================================================================================
# [2019.x/2020.x/2021.x/2022.x-android] Setup Android SDK and NDK Variables
#=======================================================================================
RUN echo "$version-$module" | grep -q -vP '^20(?!18).*android' \\
  && exit 0 \\
  || : \\
  # Environment Variables
  && export RAW_ANDROID_SDK_ROOT=$(jq -cr '(.[] | select(.id | contains("android-sdk-platform-tools"))).destination' $UNITY_PATH/modules.json) \\
  # We need to replace some characters common to paths that will break the sed expression when expanded
  && export ESCAPED_UNITY_PATH=$(printf '%s' "$UNITY_PATH" | sed 's/[#\\/]/\\\\\\0/g') \\
  && export ANDROID_SDK_ROOT=$(echo $RAW_ANDROID_SDK_ROOT | sed -e "s/{UNITY_PATH}/$ESCAPED_UNITY_PATH/g") \\
  && export ANDROID_HOME=\${ANDROID_SDK_ROOT} \\
  && export RAW_ANDROID_NDK_ROOT=$(jq -cr '(.[] | select(.id | contains("android-ndk"))).destination' $UNITY_PATH/modules.json) \\
  && export ANDROID_NDK_HOME=$(echo $RAW_ANDROID_NDK_ROOT | sed -e "s/{UNITY_PATH}/$ESCAPED_UNITY_PATH/g") \\
  && export RAW_JAVA_HOME=$(jq -cr '(.[] | select(.id | contains("android-open-jdk"))).destination' $UNITY_PATH/modules.json) \\
  && export ESCAPED_JAVA_HOME=$(echo $RAW_JAVA_HOME | sed -e "s/{UNITY_PATH}/$ESCAPED_UNITY_PATH/g") \\
  # Unity 2019.x doesn't have the jdk in the modules, so put in a fallback. sdkmanager will fail if invalid
  && export JAVA_HOME=\${ESCAPED_JAVA_HOME:-$UNITY_PATH/Editor/Data/PlaybackEngines/AndroidPlayer/Tools/OpenJDK/Linux} \\
  && export PATH=$JAVA_HOME/bin:\${ANDROID_SDK_ROOT}/tools:\${ANDROID_SDK_ROOT}/tools/bin:\${ANDROID_SDK_ROOT}/platform-tools:\${PATH} \\
  \\
  # Update alias 'unity-editor'
  && { \\
    echo "export ANDROID_SDK_ROOT=\${ANDROID_SDK_ROOT}"; \\
    echo "export ANDROID_HOME=\${ANDROID_HOME}"; \\
    echo "export ANDROID_NDK_HOME=\${ANDROID_NDK_HOME}"; \\
    echo "export JAVA_HOME=\${JAVA_HOME}"; \\
    echo "export PATH=\${PATH}"; \\
  } > /usr/bin/unity-editor.d/android-2019+.sh \\
  # Update '~/.bashrc' to enable using variables when logging in
  && echo ". /usr/bin/unity-editor.d/android-2019+.sh" >> ~/.bashrc

#=======================================================================================
# [2021.x/2022.x/6000+-android] Set CMDLINE Tools Path
#=======================================================================================
RUN echo "$version-$module" | grep -q -vP '^(202[1-9]|[6-9][0-9]{3}|[1-9][0-9]{4,}).*android' \\
  && exit 0 \\
  || : \\
  && . ~/.bashrc \\
  && export ESCAPED_UNITY_PATH=$(printf '%s' "$UNITY_PATH" | sed 's/[#\\/]/\\\\\\0/g') \\
  && export RAW_ANDROID_SDK_ROOT=$(jq -cr '(.[] | select(.id | contains("android-sdk-platform-tools")) | .destination) // (.[] | select(.id | contains("android-sdk-ndk-tools")) | .destination)' $UNITY_PATH/modules.json) \\
  && export ANDROID_SDK_ROOT=$(echo $RAW_ANDROID_SDK_ROOT | sed -e "s/{UNITY_PATH}/$ESCAPED_UNITY_PATH/g") \\
  && export ANDROID_HOME=\${ANDROID_SDK_ROOT} \\
  && export RAW_ANDROID_NDK_ROOT=$(jq -cr '(.[] | select(.id | contains("android-ndk"))).destination' $UNITY_PATH/modules.json) \\
  && export ANDROID_NDK_HOME=$(echo $RAW_ANDROID_NDK_ROOT | sed -e "s/{UNITY_PATH}/$ESCAPED_UNITY_PATH/g") \\
  && export RAW_CMDLINE_TOOLS_PATH=$(jq -cr '(.[] | select(.id | contains("android-sdk-command-line-tools"))).renameTo' $UNITY_PATH/modules.json) \\
  && export ESCAPED_CMDLINE_TOOLS_PATH=$(echo $RAW_CMDLINE_TOOLS_PATH | sed -e "s/{UNITY_PATH}/$ESCAPED_UNITY_PATH/g") \\
  # Fallback because some Unity versions don't have command line tools in modules.json and sdkmanager fails if invalid
  && export ANDROID_CMDLINE_TOOLS_PATH=\${ESCAPED_CMDLINE_TOOLS_PATH:-$UNITY_PATH/Editor/Data/PlaybackEngines/AndroidPlayer/SDK/tools} \\
  && export RAW_JAVA_HOME=$(jq -cr '(.[] | select(.id | contains("android-open-jdk"))).destination' $UNITY_PATH/modules.json) \\
  && export JAVA_HOME=$(echo $RAW_JAVA_HOME | sed -e "s/{UNITY_PATH}/$ESCAPED_UNITY_PATH/g") \\
  # Prefer cmdline tools over legacy tools
  && export PATH=\${JAVA_HOME}/bin:\${ANDROID_CMDLINE_TOOLS_PATH}/bin:\${PATH} \\
  && { \\
    echo "export ANDROID_SDK_ROOT=\${ANDROID_SDK_ROOT}"; \\
    echo "export ANDROID_HOME=\${ANDROID_HOME}"; \\
    echo "export ANDROID_NDK_HOME=\${ANDROID_NDK_HOME}"; \\
    echo "export JAVA_HOME=\${JAVA_HOME}"; \\
    echo "export ANDROID_CMDLINE_TOOLS_PATH=\${ANDROID_CMDLINE_TOOLS_PATH}"; \\
    echo "export PATH=\${PATH}"; \\
  } > /usr/bin/unity-editor.d/android-2019+.sh \\
  # Update '~/.bashrc' to enable using variables when logging in
  && echo ". /usr/bin/unity-editor.d/android-2019+.sh" >> ~/.bashrc

#=======================================================================================
# [2019.x/2020.x-android] Accept Android SDK licenses via old sdkmanager
#=======================================================================================
RUN echo "$version-$module" | grep -q -vP '^(20(19|20)).*android' \\
  && exit 0 \\
  || : \\
  && . ~/.bashrc \\
  && yes | "\${ANDROID_HOME}/tools/bin/sdkmanager" --licenses

#=======================================================================================
# [2021.x/2022.x/6000+-android] Accept Android SDK licenses via new cmdline-tools sdkmanager
#=======================================================================================
RUN echo "$version-$module" | grep -q -vP '^(202[1-9]|[6-9][0-9]{3}|[1-9][0-9]{4,}).*android' \\
  && exit 0 \\
  || : \\
  && . ~/.bashrc \\
  && yes | "\${ANDROID_CMDLINE_TOOLS_PATH}/bin/sdkmanager" --licenses

#=======================================================================================
# [6000+-android] Install platform-tools if missing
#=======================================================================================
RUN echo "$version-$module" | grep -q -vP '^([6-9][0-9]{3}|[1-9][0-9]{4,}).*android' \\
  && exit 0 \\
  || : \\
  && . ~/.bashrc \\
  && if [ ! -d "\${ANDROID_HOME}/platform-tools" ]; then \\
    echo "Installing platform-tools..."; \\
    "\${ANDROID_CMDLINE_TOOLS_PATH}/bin/sdkmanager" "platform-tools"; \\
  else \\
    echo "platform-tools already exists at \${ANDROID_HOME}/platform-tools"; \\
  fi

#=======================================================================================
# [2022.2+-android] Fix for symlink issue on Android
#=======================================================================================
RUN echo "$version-$module" | grep -q -vP '^(2022.[2-9]|202[3-9]|20[3-9]).*android' \\
  && exit 0 \\
  || : \\
  && . ~/.bashrc \\
  && cd "\${ANDROID_NDK_HOME}/toolchains/llvm/prebuilt/linux-x86_64/bin" \\
  # Symlink any file less than 64 bytes to the file name within the file. We assume there are no real files that small
  && for f in $(find . -type f -size -64c); do target=$(cat $f) && echo "Making symlink $f -> $target" && rm $f && ln -s $target $f ; done

#=======================================================================================
# [webgl] Support audio using ffmpeg (~99MB)
#=======================================================================================
RUN echo "$module" | grep -q -v 'webgl' \\
  && exit 0 \\
  || : \\
  && apt-get update \\
  && apt-get -q install -y --no-install-recommends --allow-downgrades \\
    ffmpeg \\
  && apt-get clean \\
  && rm -rf /var/lib/apt/lists/*

#=======================================================================================
# [webgl, il2cpp] build-essential clang
#=======================================================================================
RUN echo "$module" | grep -q -v '\\(webgl\\|linux-il2cpp\\)' \\
  && exit 0 \\
  || : \\
  && apt-get -q update \\
  && apt-get -q install -y --no-install-recommends --allow-downgrades \\
    build-essential \\
    clang \\
  && apt-get clean \\
  && rm -rf /var/lib/apt/lists/*

#=======================================================================================
# [2019.x] libnotify4 libunwind-dev libssl1.0.0
#=======================================================================================
RUN echo "$version" | grep -q -v '^2019.' \\
  && exit 0 \\
  || : \\
  && apt-get -q update \\
  && apt-get -q install -y --no-install-recommends --allow-downgrades \\
    libnotify4 \\
    libunwind-dev \\
  && apt-get clean \\
  && rm -rf /var/lib/apt/lists/* \\
  # Install libssl1.0.0
  && wget http://security.ubuntu.com/ubuntu/pool/main/o/openssl/libssl1.0.0_1.0.2g-1ubuntu4.20_amd64.deb \\
  && dpkg -i libssl1.0.0_1.0.2g-1ubuntu4.20_amd64.deb \\
  && rm libssl1.0.0_1.0.2g-1ubuntu4.20_amd64.deb

#=======================================================================================
# [2018.x/2019.x/2020.x/2021.1.x-webgl] python2
#=======================================================================================
RUN echo "$version-$module" | grep -q -v '^\\(2018\\|2019\\|2020\\|2021.1\\).*webgl' \\
  && exit 0 \\
  || : \\
  && apt-get -q update \\
  && apt-get -q install -y --no-install-recommends --allow-downgrades \\
    python-setuptools \\
  && apt-get clean \\
  && rm -rf /var/lib/apt/lists/* \\
  && ln -s /usr/bin/python2 /usr/bin/python

#=======================================================================================
# [2018.x/2019.x/2020.1.x-webgl] support brotli compression for linux
#=======================================================================================
RUN echo "$version-$module" | grep -q -v '^\\(2018\\|2019\\|2020.1\\).*webgl' \\
  && exit 0 \\
  || : \\
  && cp \\
    $UNITY_PATH/Editor/Data/PlaybackEngines/WebGLSupport/BuildTools/Brotli/dist/Brotli-0.4.0-py2.7-linux-x86_64.egg \\
    $UNITY_PATH/Editor/Data/PlaybackEngines/WebGLSupport/BuildTools/Brotli/dist/Brotli-0.4.0-py2.7-macosx-10.10-x86_64.egg

#=======================================================================================
# [2021.x/2022.x-mac-mono] x64arm64/x64ARM64 case issue https://github.com/game-ci/unity-builder/issues/320
#=======================================================================================
RUN echo "$version-$module" | grep -q -v '^202[12].*mac-mono' \\
  && exit 0 \\
  || : \\
  && ln -s \\
    $UNITY_PATH/Editor/Data/PlaybackEngines/MacStandaloneSupport/Variations/macos_x64arm64_player_nondevelopment_mono \\
    $UNITY_PATH/Editor/Data/PlaybackEngines/MacStandaloneSupport/Variations/macos_x64ARM64_player_nondevelopment_mono \\
  && ln -s \\
    $UNITY_PATH/Editor/Data/PlaybackEngines/MacStandaloneSupport/Variations/macos_x64arm64_player_development_mono \\
    $UNITY_PATH/Editor/Data/PlaybackEngines/MacStandaloneSupport/Variations/macos_x64ARM64_player_development_mono

#=======================================================================================
# [2021.x-linux-il2cpp] lld
#=======================================================================================
RUN echo "$version-$module" | grep -q -v '^2021.*linux-il2cpp' \\
  && exit 0 \\
  || : \\
  && apt-get -q update \\
  && apt-get -q install -y --no-install-recommends --allow-downgrades \\
    lld \\
  && apt-get clean \\
  && rm -rf /var/lib/apt/lists/*
`;
}
function generateWindowsDockerfile() {
  return `ARG baseImage="unityci/base:windows-latest"
ARG hubImage="unityci/hub:windows-latest"

#############
#  Builder  #
#############

FROM $hubImage AS Builder

# Using bash to process unity install
RUN choco install git --no-progress -y

SHELL ["cmd", "/S", "/C"]

RUN setx path "C:\\\\Program Files\\\\Git\\\\bin;%path%"

SHELL ["bash.exe", "-c"]

# Install Editor
ARG version
ARG changeSet

RUN "mkdir -p /var/log && mkdir -p C:/UnityEditor"

RUN "C:/Program\\\\ Files/Unity\\\\ Hub/Unity\\\\ Hub.exe -- --headless install-path --set C:/UnityEditor"

RUN "C:/Program\\\\ Files/Unity\\\\ Hub/Unity\\\\ Hub.exe -- --headless install \\
                                                    --version $version \\
                                                    --changeset $changeSet \\
                                                    | tee /var/log/install-editor.log \\
                                                    && grep 'Error' /var/log/install-editor.log \\
                                                    | exit $(wc -l)"

ARG module
RUN "for mod in $module; do \\
       if [ "$mod" = 'base' ]; then \\
         echo 'running default modules for this base OS'; \\
       else \\
         C:/Program\\\\ Files/Unity\\\\ Hub/Unity\\\\ Hub.exe -- --headless install-modules \\
                                                     --version $version \\
                                                     --module "$mod" \\
                                                     --childModules \\
                                                     | tee /var/log/install-module-\${mod}.log \\
                                                     && grep 'Missing module' /var/log/install-module-\${mod}.log \\
                                                     | exit $(wc -l); \\
       fi; \\
     done"

############
#  Editor  #
############

FROM $baseImage

SHELL ["powershell.exe", "-Command"]

# Copy the editor from the builder to the final editor image
COPY --from=Builder ["C:/UnityEditor/", "C:/UnityEditor/"]

# Need to grab these dependencies that the editor needs to run
COPY --from=Builder C:/windows/system32/MSVCP100.dll \\
                    C:/windows/system32/MSVCR100.dll \\
                    C:/windows/system32/

# Add version to file at editor path
ARG version
RUN echo "$Env:version" > "C:/UnityEditor/$Env:version/version"

RUN setx -M UNITY_PATH "C:/UnityEditor/$Env:version"

# Packages/manifest.json could have git dependencies
RUN choco install git --no-progress -y

# Unity package manager throws an error about not being in a git directory when
# importing git packages without this
RUN git config --global --add safe.directory "*"

# Need to enable these services to make Unity happy
RUN foreach ("$service" in 'nlasvc', 'netprofm') {"Set-Service $service -StartupType Automatic"}

#=======================================================================================
# [android] Setup Android SDK, NDK, JDK, cmdline tools and accept licenses
#=======================================================================================
# Inline the PowerShell helper functions and setup logic
ARG module
RUN if ("$Env:module" -match 'android|Android') { \\
      # HelperFunctions \\
      function Find-Module { \\
        param($ModuleList, $ModuleID) \\
        $index = $ModuleList.FindIndex({$$args[0].id.contains($ModuleID)}) \\
        return $index -ne -1 \\
      } \\
      function Get-ModuleDestinationPath { \\
        param($ModuleList, $ModuleID, $UnityPath) \\
        $index = $ModuleList.FindIndex({$$args[0].id.contains($ModuleID)}) \\
        $rawPath = $ModuleList[$index].destination \\
        if ($$null -eq $rawPath) { throw "Unable to get a destination path for $ModuleID" } \\
        return $rawPath.Replace('{UNITY_PATH}', $UnityPath) \\
      } \\
      function Get-ModuleRenamedPath { \\
        param($ModuleList, $ModuleID, $UnityPath) \\
        $index = $ModuleList.FindIndex({$$args[0].id.contains($ModuleID)}) \\
        $rawPath = $ModuleList[$index].extractedPathRename.to \\
        if ($$null -eq $rawPath) { $rawPath = $ModuleList[$index].renameTo } \\
        if ($$null -eq $rawPath) { throw "Unable to get a ModuleRenamedPath for $ModuleID" } \\
        return $rawPath.Replace('{UNITY_PATH}', $UnityPath) \\
      } \\
      # SetupAndroid \\
      [void][System.Reflection.Assembly]::LoadWithPartialName("System.Web.Extensions") \\
      $raw_modules = Get-Content "$Env:UNITY_PATH/modules.json" \\
      $UNITY_MODULES_JSON = (New-Object -TypeName System.Web.Script.Serialization.JavaScriptSerializer -Property @{MaxJsonLength=67108864}).DeserializeObject($raw_modules) \\
      $UNITY_MODULES_LIST = [Collections.Generic.List[Object]]($UNITY_MODULES_JSON) \\
      $ANDROID_SDK_ROOT = Get-ModuleDestinationPath $UNITY_MODULES_LIST 'android-sdk-platform-tools' $Env:UNITY_PATH \\
      $ANDROID_NDK_HOME = Get-ModuleDestinationPath $UNITY_MODULES_LIST 'android-ndk' $Env:UNITY_PATH \\
      $JAVA_HOME = Get-ModuleDestinationPath $UNITY_MODULES_LIST 'android-open-jdk' $Env:UNITY_PATH \\
      if (Find-Module $UNITY_MODULES_LIST 'android-sdk-command-line-tools') { \\
        $TOOLS_PATH = Get-ModuleRenamedPath $UNITY_MODULES_LIST 'android-sdk-command-line-tools' $Env:UNITY_PATH \\
      } else { \\
        $TOOLS_PATH = "$ANDROID_SDK_ROOT/tools" \\
      } \\
      $newPath = "$JAVA_HOME/bin;$ANDROID_SDK_ROOT/tools;$TOOLS_PATH/bin;$ANDROID_SDK_ROOT/platform-tools;$ANDROID_NDK_HOME/toolchains/llvm/prebuilt/windows-x86_64/bin;C:/Program Files/Git/bin" \\
      $oldPath = [Environment]::GetEnvironmentVariable('PATH', 'Machine') \\
      [Environment]::SetEnvironmentVariable('PATH', "$newPath;$oldPath", 'Machine') \\
      [Environment]::SetEnvironmentVariable('ANDROID_HOME', "$ANDROID_SDK_ROOT", 'Machine') \\
      [Environment]::SetEnvironmentVariable('ANDROID_NDK_HOME', "$ANDROID_NDK_HOME", 'Machine') \\
      [Environment]::SetEnvironmentVariable('JAVA_HOME', "$JAVA_HOME", 'Machine') \\
      [Environment]::SetEnvironmentVariable('ANDROID_CMDLINE_TOOLS', "$TOOLS_PATH", 'Machine') \\
      New-Item -ItemType file -Path "$Env:USERPROFILE/.android/repositories.cfg" -Force \\
    }

# Accept Android Licenses (separate step so env vars from above are available)
RUN if ("$Env:module" -match 'android|Android') { \\
      Set-Location "$Env:ANDROID_CMDLINE_TOOLS/bin" \\
      bash -c "yes | ./sdkmanager.bat --licenses" \\
    }
`;
}

// src/plugin/plugin-registry.ts
var globalLogger = typeof globalThis !== "undefined" && "log" in globalThis ? globalThis.log : undefined;

class PluginRegistry {
  static plugins = [];
  static engineDetectors = [];
  static commandPlugins = [];
  static optionsPlugins = [];
  static providerConstructors = new Map;
  static async register(plugin) {
    PluginRegistry.plugins.push(plugin);
    if (plugin.engineDetectors) {
      PluginRegistry.engineDetectors.push(...plugin.engineDetectors);
    }
    if (plugin.commands) {
      PluginRegistry.commandPlugins.push(...plugin.commands);
    }
    if (plugin.options) {
      PluginRegistry.optionsPlugins.push(...plugin.options);
    }
    if (plugin.providers) {
      for (const [name, ctor] of Object.entries(plugin.providers)) {
        PluginRegistry.providerConstructors.set(name, ctor);
      }
    }
    if (plugin.onLoad) {
      await plugin.onLoad();
    }
    globalLogger?.info?.(`Plugin registered: ${plugin.name}${plugin.version ? ` v${plugin.version}` : ""}`);
  }
  static async registerOnce(plugin) {
    if (PluginRegistry.hasPlugin(plugin.name)) {
      return;
    }
    await PluginRegistry.register(plugin);
  }
  static hasPlugin(name) {
    return PluginRegistry.plugins.some((plugin) => plugin.name === name);
  }
  static detectEngine(projectPath) {
    for (const detector of PluginRegistry.engineDetectors) {
      const result = detector.detect(projectPath);
      if (result && result.engine !== "unknown") {
        return result;
      }
    }
    return { engine: "unknown", engineVersion: "unknown" };
  }
  static createCommand(engine, command2, subCommands) {
    for (const plugin of PluginRegistry.commandPlugins) {
      if (plugin.engine === engine) {
        const cmd = plugin.createCommand(command2, subCommands);
        if (cmd)
          return cmd;
      }
    }
    return null;
  }
  static async configureOptions(engine, yargs) {
    for (const plugin of PluginRegistry.optionsPlugins) {
      if (plugin.engine === engine || plugin.engine === "*") {
        await plugin.configure(yargs);
      }
    }
  }
  static createProvider(strategy, buildParameters) {
    const Ctor = PluginRegistry.providerConstructors.get(strategy);
    if (!Ctor)
      return null;
    return new Ctor(buildParameters);
  }
  static getAvailableProviders() {
    return Array.from(PluginRegistry.providerConstructors.keys());
  }
  static getRegisteredEngines() {
    return PluginRegistry.engineDetectors.map((d) => d.name);
  }
  static getRegisteredPlugins() {
    return [...PluginRegistry.plugins];
  }
  static reset() {
    PluginRegistry.plugins = [];
    PluginRegistry.engineDetectors = [];
    PluginRegistry.commandPlugins = [];
    PluginRegistry.optionsPlugins = [];
    PluginRegistry.providerConstructors = new Map;
  }
}

// src/command/command-factory.ts
class CommandFactory {
  engine = Engine.unknown;
  engineVersion;
  constructor() {}
  selectEngine(engine, engineVersion) {
    this.engine = engine;
    this.engineVersion = engineVersion;
    return this;
  }
  createCommand(commandArray) {
    const [command2, ...subCommands] = commandArray;
    if (command2 === "config") {
      return this.createConfigCommand(command2, subCommands);
    }
    if (command2 === "build-unity-image") {
      return new BuildImageCommand(command2);
    }
    if (this.engine === Engine.unknown) {
      throw new Error("Engine not detected from projectPath");
    }
    const pluginCommand = PluginRegistry.createCommand(this.engine, command2, subCommands);
    if (pluginCommand) {
      return pluginCommand;
    }
    throw new Error(`Engine "${this.engine}" is registered but has no handler for command "${command2}".`);
  }
  createConfigCommand(command2, subCommands) {
    switch (subCommands[0]) {
      case "open":
        return new OpenConfigFolderCommand(command2);
      default:
        return new NonExistentCommand([command2, ...subCommands].join(" "));
    }
  }
}

// src/command-options/project-options.ts
init_dependencies();

// src/middleware/engine-detection/engine-detector.ts
class EngineDetector {
  projectPath;
  constructor(projectPath) {
    this.projectPath = projectPath;
  }
  detect() {
    return PluginRegistry.detectEngine(this.projectPath);
  }
}

// src/middleware/engine-detection/index.ts
var engineDetection = async (argv) => {
  let { projectPath } = argv;
  if (!projectPath)
    projectPath = process.cwd();
  const { engine, engineVersion } = new EngineDetector(projectPath).detect();
  argv.engine = engine;
  argv.engineVersion = engineVersion;
};

// src/middleware/vcs-detection/git-detector.ts
init_system();

class GitDetector {
  projectPath;
  constructor(projectPath) {
    this.projectPath = projectPath;
  }
  async isGitRepository() {
    const { status } = await System.run(`git -C '${this.projectPath}' rev-parse`, undefined, { silent: true });
    return status?.code === 0;
  }
  async getCurrentBranch() {
    let branchName = this.headRef || this.ref?.slice(11);
    if (!branchName) {
      const { status, output } = await System.run("git branch --show-current", undefined, { cwd: this.projectPath });
      if (!status?.success)
        throw new Error('did not expect "git branch --show-current"');
      branchName = output;
    }
    return branchName;
  }
  get headRef() {
    return process.env.GITHUB_HEAD_REF;
  }
  get ref() {
    return process.env.GITHUB_REF;
  }
}

// src/middleware/vcs-detection/index.ts
var vcsDetection = async (argv) => {
  const { projectPath } = argv;
  const gitDetector = new GitDetector(projectPath);
  if (await gitDetector.isGitRepository()) {
    argv.branch = await gitDetector.getCurrentBranch();
  }
};

// src/command-options/project-options.ts
class ProjectOptions {
  static preConfigure(yargs) {
    yargs.positional("projectPath", {
      describe: "Path to the project",
      type: "string",
      demandOption: false,
      default: "."
    }).coerce("projectPath", async (arg) => {
      const homeDir = getHomeDir();
      if (homeDir === null)
        throw new Error("Could not determine home directory");
      return arg.replace(/^~/, homeDir).replace(/\/$/, "");
    }).default("engine", "").default("engineVersion", "").middleware([engineDetection], true).default("branch", "").middleware([vcsDetection], true);
  }
  static async configure(yargs) {}
}

// src/cli-commands.ts
class CliCommands {
  yargs;
  register;
  constructor(yargs, register) {
    this.yargs = yargs;
    this.register = register;
  }
  async registerAll() {
    await this.configCommand();
    await this.testCommand();
    await this.buildCommand();
    await this.buildImageCommand();
    await this.orchestrateCommand();
    await this.remoteCommands();
    await this.yargs.parseAsync();
  }
  async configCommand() {
    await this.yargs.command("config", "GameCI CLI configuration", async (yargs) => {
      yargs.command("open", "Opens the CLI configuration folder", async (yargs2) => {});
      this.register(yargs);
    });
  }
  async testCommand() {
    await this.yargs.command("test [projectPath]", "Runs the tests of a given project", async (yargs) => {
      ProjectOptions.preConfigure(yargs);
      this.register(yargs);
    });
  }
  async buildCommand() {
    await this.yargs.command("build [projectPath]", "Builds a given project", async (yargs) => {
      ProjectOptions.preConfigure(yargs);
      this.register(yargs);
    });
  }
  async buildImageCommand() {
    await this.yargs.command("build-unity-image [baseOs] [modules]", "Build a Unity editor Docker image with specified modules", async (yargs) => {
      this.register(yargs);
    });
  }
  async orchestrateCommand() {
    await this.yargs.command("orchestrate [projectPath]", "Run an engine job through a provider plugin", async (yargs) => {
      ProjectOptions.preConfigure(yargs);
      this.register(yargs);
    });
  }
  async remoteCommands() {
    await this.yargs.command("remote", false, async (yargs) => {
      yargs.command("run [projectPath]", false, async (yargs2) => {
        ProjectOptions.preConfigure(yargs2);
        this.register(yargs2);
      }).command("build [projectPath]", false, async (yargs2) => {
        ProjectOptions.preConfigure(yargs2);
        this.register(yargs2);
      }).command("otherSubCommand", "Other sub command", async (yargs2) => {
        ProjectOptions.preConfigure(yargs2);
        this.register(yargs2);
      });
    });
  }
}

// src/plugin/cli-protocol-plugin.ts
var DEFAULT_TIMEOUT_MS = 300000;
var RUN_TASK_TIMEOUT_MS = 7200000;
var WATCH_WORKFLOW_TIMEOUT_MS = 3600000;

class CliProtocolPlugin {
  executablePath;
  executableArgs;
  buildOptions;
  constructor(options) {
    const executable = options.providerExecutable || options.cliExecutable;
    if (!executable || typeof executable !== "string") {
      throw new Error("CliProtocolPlugin requires --provider-executable (path to orchestrator binary). " + "Example: game-ci orchestrate --providerStrategy cli-protocol --provider-executable ./game-ci-orchestrator");
    }
    this.executablePath = executable;
    this.executableArgs = ["serve"];
    if (options.providerBackend) {
      this.executableArgs.push("--provider-strategy", options.providerBackend);
    }
    const { providerExecutable, cliExecutable, providerArgs, ...rest } = options;
    this.buildOptions = rest;
  }
  async setupWorkflow(buildGuid, buildParameters, branchName, defaultSecretsArray) {
    const response = await this.execute("setup-workflow", {
      buildGuid,
      buildParameters: buildParameters || this.buildOptions,
      branchName,
      defaultSecretsArray
    });
    return response.result;
  }
  async cleanupWorkflow(buildParameters, branchName, defaultSecretsArray) {
    const response = await this.execute("cleanup-workflow", {
      buildParameters: buildParameters || this.buildOptions,
      branchName,
      defaultSecretsArray
    });
    return response.result;
  }
  async runTaskInWorkflow(buildGuid, image, commands, mountdir, workingdir, environment, secrets) {
    const response = await this.executeStreaming("run-task", {
      buildGuid,
      image,
      commands,
      mountdir,
      workingdir,
      environment,
      secrets
    }, RUN_TASK_TIMEOUT_MS);
    return response.output || "";
  }
  async garbageCollect(filter, previewOnly, olderThan, fullCache, baseDependencies) {
    const response = await this.execute("garbage-collect", {
      filter,
      previewOnly,
      olderThan,
      fullCache,
      baseDependencies
    });
    return response.output || "";
  }
  async listResources() {
    const response = await this.execute("list-resources", {});
    return response.result || [];
  }
  async listWorkflow() {
    const response = await this.execute("list-workflow", {});
    return response.result || [];
  }
  async watchWorkflow() {
    const response = await this.executeStreaming("watch-workflow", {}, WATCH_WORKFLOW_TIMEOUT_MS);
    return response.output || "";
  }
  execute(command2, params, timeoutMs = DEFAULT_TIMEOUT_MS) {
    const request = { command: command2, params };
    return new Promise((resolve5, reject) => {
      const proc = Bun.spawn([this.executablePath, ...this.executableArgs], {
        stdin: "pipe",
        stdout: "pipe",
        stderr: "pipe"
      });
      let timedOut = false;
      const timer = setTimeout(() => {
        timedOut = true;
        proc.kill();
        reject(new Error(`CliProtocolPlugin: command '${command2}' timed out after ${timeoutMs}ms`));
      }, timeoutMs);
      const writer = proc.stdin.getWriter();
      writer.write(new TextEncoder().encode(JSON.stringify(request)));
      writer.close();
      Promise.all([
        new Response(proc.stdout).text(),
        new Response(proc.stderr).text(),
        proc.exited
      ]).then(([stdout, stderr, exitCode]) => {
        clearTimeout(timer);
        if (timedOut)
          return;
        if (stderr.trim()) {
          for (const line of stderr.trim().split(`
`)) {
            log?.info?.(`[cli-protocol] ${line}`);
          }
        }
        const lines = stdout.split(`
`).filter((l) => l.trim());
        let response;
        for (let i = lines.length - 1;i >= 0; i--) {
          try {
            const parsed = JSON.parse(lines[i].trim());
            if (typeof parsed === "object" && parsed !== null && "success" in parsed) {
              response = parsed;
              break;
            }
          } catch {}
        }
        if (response) {
          if (response.success) {
            resolve5(response);
          } else {
            reject(new Error(`CliProtocolPlugin ${command2} failed: ${response.error || "Unknown error"}`));
          }
        } else if (exitCode === 0) {
          resolve5({ success: true, output: stdout.trim() });
        } else {
          reject(new Error(`CliProtocolPlugin ${command2} exited with code ${exitCode}` + (stderr ? `: ${stderr.trim()}` : "")));
        }
      }).catch((error) => {
        clearTimeout(timer);
        if (!timedOut) {
          reject(new Error(`CliProtocolPlugin: failed to spawn '${this.executablePath}': ${error.message}`));
        }
      });
    });
  }
  executeStreaming(command2, params, timeoutMs) {
    const request = { command: command2, params };
    return new Promise((resolve5, reject) => {
      const proc = Bun.spawn([this.executablePath, ...this.executableArgs], {
        stdin: "pipe",
        stdout: "pipe",
        stderr: "pipe"
      });
      let timedOut = false;
      const timer = setTimeout(() => {
        timedOut = true;
        proc.kill();
        reject(new Error(`CliProtocolPlugin: command '${command2}' timed out after ${timeoutMs}ms`));
      }, timeoutMs);
      const writer = proc.stdin.getWriter();
      writer.write(new TextEncoder().encode(JSON.stringify(request)));
      writer.close();
      const outputLines = [];
      let lastJsonResponse;
      const stdoutReader = proc.stdout.getReader();
      const decoder = new TextDecoder;
      let stdoutBuffer = "";
      function readStdout() {
        return stdoutReader.read().then(({ done, value }) => {
          if (done)
            return;
          stdoutBuffer += decoder.decode(value, { stream: true });
          const lines = stdoutBuffer.split(`
`);
          stdoutBuffer = lines.pop() || "";
          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed)
              continue;
            try {
              const parsed = JSON.parse(trimmed);
              if (typeof parsed === "object" && parsed !== null && "success" in parsed) {
                lastJsonResponse = parsed;
                continue;
              }
            } catch {}
            log?.info?.(trimmed);
            outputLines.push(trimmed);
          }
          return readStdout();
        });
      }
      const stderrPromise = new Response(proc.stderr).text();
      Promise.all([readStdout(), stderrPromise, proc.exited]).then(([, stderr, exitCode]) => {
        clearTimeout(timer);
        if (timedOut)
          return;
        if (stdoutBuffer.trim()) {
          const trimmed = stdoutBuffer.trim();
          try {
            const parsed = JSON.parse(trimmed);
            if (typeof parsed === "object" && parsed !== null && "success" in parsed) {
              lastJsonResponse = parsed;
            } else {
              outputLines.push(trimmed);
            }
          } catch {
            outputLines.push(trimmed);
          }
        }
        if (stderr.trim()) {
          for (const line of stderr.trim().split(`
`)) {
            log?.info?.(`[cli-protocol] ${line}`);
          }
        }
        if (lastJsonResponse) {
          if (lastJsonResponse.success) {
            resolve5({
              ...lastJsonResponse,
              output: lastJsonResponse.output || outputLines.join(`
`)
            });
          } else {
            reject(new Error(`CliProtocolPlugin ${command2} failed: ${lastJsonResponse.error || "Unknown error"}`));
          }
        } else if (exitCode === 0) {
          resolve5({ success: true, output: outputLines.join(`
`) });
        } else {
          reject(new Error(`CliProtocolPlugin ${command2} exited with code ${exitCode}` + (stderr ? `: ${stderr.trim()}` : "")));
        }
      }).catch((error) => {
        clearTimeout(timer);
        if (!timedOut) {
          reject(new Error(`CliProtocolPlugin: failed to spawn '${this.executablePath}': ${error.message}`));
        }
      });
    });
  }
}

// src/plugin/plugin-loader.ts
import * as path2 from "node:path";
import * as fs from "node:fs";
var globalLogger2 = typeof globalThis !== "undefined" && "log" in globalThis ? globalThis.log : undefined;

class PluginLoader {
  static async load(source) {
    let plugin;
    if (source.startsWith("executable:")) {
      plugin = PluginLoader.loadFromExecutable(source.slice(11));
    } else if (source.startsWith("github:")) {
      plugin = await PluginLoader.loadFromGitHub(source.slice(7));
    } else if (source.startsWith(".") || source.startsWith("/") || path2.isAbsolute(source)) {
      plugin = await PluginLoader.loadFromPath(source);
    } else {
      plugin = await PluginLoader.loadFromNpm(source);
    }
    PluginLoader.validate(plugin, source);
    await PluginRegistry.registerOnce(plugin);
    return plugin;
  }
  static async loadAll(sources) {
    const plugins = [];
    for (const source of new Set(sources)) {
      try {
        const plugin = await PluginLoader.load(source);
        plugins.push(plugin);
      } catch (error) {
        globalLogger2?.warning?.(`Failed to load plugin from "${source}": ${error.message}`);
      }
    }
    return plugins;
  }
  static async loadFromNpm(packageName) {
    const mod = await import(packageName);
    return mod.default || mod;
  }
  static async loadFromPath(localPath) {
    const resolvedPath = path2.resolve(localPath);
    if (!fs.existsSync(resolvedPath)) {
      throw new Error(`Plugin path does not exist: ${resolvedPath}`);
    }
    const mod = await import(resolvedPath);
    return mod.default || mod;
  }
  static loadFromExecutable(executablePath) {
    const resolvedPath = path2.resolve(executablePath);
    if (!fs.existsSync(resolvedPath)) {
      throw new Error(`Executable plugin path does not exist: ${resolvedPath}`);
    }
    const CliProtocolPluginCtor = class extends CliProtocolPlugin {
      constructor(options) {
        super({ ...options, providerExecutable: resolvedPath });
      }
    };
    return {
      name: `executable:${path2.basename(resolvedPath)}`,
      version: "1.0.0",
      providers: {
        "cli-protocol": CliProtocolPluginCtor
      }
    };
  }
  static async loadFromGitHub(repo) {
    throw new Error(`Direct GitHub repo loading not yet implemented for "${repo}". Publish the plugin to npm or use a local path instead.`);
  }
  static validate(plugin, source) {
    if (!plugin || typeof plugin !== "object") {
      throw new Error(`Plugin from "${source}" did not export a valid GameCIPlugin object`);
    }
    if (!plugin.name || typeof plugin.name !== "string") {
      throw new Error(`Plugin from "${source}" must export a "name" string`);
    }
    if (plugin.engineDetectors) {
      for (const detector of plugin.engineDetectors) {
        if (typeof detector.detect !== "function") {
          throw new Error(`Engine detector "${detector.name}" in plugin "${plugin.name}" must have a detect() method`);
        }
      }
    }
    if (plugin.commands) {
      for (const cmd of plugin.commands) {
        if (!cmd.engine || typeof cmd.createCommand !== "function") {
          throw new Error(`Command plugin in "${plugin.name}" must have engine and createCommand()`);
        }
      }
    }
    if (plugin.providers) {
      for (const [name, Ctor] of Object.entries(plugin.providers)) {
        if (typeof Ctor !== "function") {
          throw new Error(`Provider "${name}" in plugin "${plugin.name}" must be a constructor function`);
        }
      }
    }
  }
}

// src/middleware/engine-detection/unity-version-detector.ts
init_dependencies();
import * as nodeFs2 from "node:fs";

class UnityVersionDetector {
  static get versionPattern() {
    return /20\d{2}\.\d\.\w{3,4}|3/;
  }
  static isUnityProject(projectPath) {
    try {
      UnityVersionDetector.read(projectPath);
      return true;
    } catch {
      return false;
    }
  }
  static getUnityVersion(projectPath) {
    return UnityVersionDetector.read(projectPath);
  }
  static read(projectPath) {
    const filePath = path.join(projectPath, "ProjectSettings", "ProjectVersion.txt");
    if (!fsSyncCompat.existsSync(filePath)) {
      throw new Error(`Project settings file not found at "${filePath}". Have you correctly set the projectPath?`);
    }
    return UnityVersionDetector.parse(nodeFs2.readFileSync(filePath, "utf-8"));
  }
  static parse(projectVersionTxt) {
    const matches = projectVersionTxt.match(UnityVersionDetector.versionPattern);
    if (!matches || matches.length === 0) {
      throw new Error(`Failed to parse version from "${projectVersionTxt}".`);
    }
    return matches[0];
  }
}

// src/command/build/unity-build-command.ts
init_model();

// src/logic/unity/platform-setup/setup-windows.ts
init_dependencies();

// src/logic/unity/platform-validation/validate-windows.ts
init_dependencies();

class ValidateWindows {
  static validate(options) {
    const { targetPlatform, unityEmail, unityPassword } = options;
    ValidateWindows.validateWindowsPlatformRequirements(targetPlatform);
    if (!unityEmail || !unityPassword) {
      throw new Error(String.dedent`
        Unity email and password must be set for Windows based builds to authenticate the license.

        Please make sure to set the unityEmail (UNITY_EMAIL) and unityPassword (UNITY_PASSWORD) parameters.
      `);
    }
  }
  static validateWindowsPlatformRequirements(platform2) {
    switch (platform2) {
      case "StandaloneWindows":
        this.checkForVisualStudio();
        this.checkForWin10SDK();
        break;
      case "StandaloneWindows64":
        this.checkForVisualStudio();
        this.checkForWin10SDK();
        break;
      case "WSAPlayer":
        this.checkForVisualStudio();
        this.checkForWin10SDK();
        break;
      case "tvOS":
        this.checkForVisualStudio();
        break;
    }
  }
  static checkForWin10SDK() {
    const windows10SDKPathExists = fsSyncCompat.existsSync("C:/Program Files (x86)/Windows Kits");
    if (!windows10SDKPathExists) {
      throw new Error(String.dedent`
        Windows 10 SDK not found in default location. Please make sure this machine has a Windows 10 SDK installed.

        Download here: https://developer.microsoft.com/en-us/windows/downloads/windows-sdk/
      `);
    }
  }
  static checkForVisualStudio() {
    const visualStudioInstallPathExists = fsSyncCompat.existsSync("C:/Program Files (x86)/Microsoft Visual Studio");
    const visualStudioDataPathExists = fsSyncCompat.existsSync("C:/ProgramData/Microsoft/VisualStudio");
    if (!visualStudioInstallPathExists || !visualStudioDataPathExists) {
      throw new Error(String.dedent`
        Visual Studio not found at the default location.

        Please make sure the runner has Visual Studio installed in the default location

        Download here: https://visualstudio.microsoft.com/downloads/
      `);
    }
  }
}

// src/logic/unity/platform-setup/setup-windows.ts
init_system();

class SetupWindows {
  static async setup(options) {
    ValidateWindows.validate(options);
    await this.generateWinSdkRegistryKey(options);
  }
  static async generateWinSdkRegistryKey(options) {
    const { targetPlatform, cliStoragePath } = options;
    if (!["StandaloneWindows", "StandaloneWindows64", "WSAPlayer"].includes(targetPlatform))
      return;
    const registryKeysPath = `${cliStoragePath}/registry-keys`;
    const copyWinSdkRegistryKeyCommand = `reg export "HKLM\\SOFTWARE\\WOW6432Node\\Microsoft\\Microsoft SDKs\\Windows\\v10.0" ${registryKeysPath}/winsdk.reg /y`;
    fsSyncCompat.ensureDir(registryKeysPath);
    await System.run(copyWinSdkRegistryKeyCommand);
  }
}

// src/logic/unity/platform-setup/setup-mac.ts
init_dependencies();
init_system();

class SetupMac {
  static unityHubBasePath = `/Applications/"Unity Hub.app"`;
  static unityHubExecPath = `${SetupMac.unityHubBasePath}/Contents/MacOS/"Unity Hub"`;
  static async setup(options) {
    const unityEditorPath = `/Applications/Unity/Hub/Editor/${options.engineVersion}/Unity.app/Contents/MacOS/Unity`;
    if (!fsSyncCompat.existsSync(this.unityHubExecPath)) {
      if (!options.isRunningLocally) {
        await SetupMac.installUnityHub(options);
      } else {
        throw new Error(String.dedent`Unity Hub is not installed at the default location.
        Please install Unity Hub at the default location and try again.`);
      }
    }
    if (!fsSyncCompat.existsSync(unityEditorPath)) {
      if (!options.isRunningLocally) {
        await SetupMac.installUnity(options);
      } else {
        throw new Error(String.dedent`Unity Editor ${options.engineVersion} is not installed at the default location.
        Please install Unity Editor ${options.engineVersion} at the default location with the necessary modules and try again.`);
      }
    }
    SetupMac.setEnvironmentVariables(options);
  }
  static async installUnityHub(options, silent = false) {
    const targetHubVersion = options.unityHubVersionOnMac !== "" ? options.unityHubVersionOnMac : await SetupMac.getLatestUnityHubVersion();
    const command2 = `brew install unity-hub@${targetHubVersion}`;
    if (!fsSyncCompat.existsSync(this.unityHubBasePath)) {
      try {
        await System.run(command2, undefined, { silent });
      } catch (error) {
        throw new Error(`There was an error installing Unity Hub. See logs above for details. ${error}`);
      }
    }
  }
  static async getLatestUnityHubVersion() {
    const hubVersionCommand = `/bin/bash -c "brew info unity-hub | grep -o '[0-9]\\+\\.[0-9]\\+\\.[0-9]\\+'"`;
    const result = await System.run(hubVersionCommand, undefined, { silent: true });
    if (result.status?.code === 0 && result.output !== "") {
      return result.output;
    }
    return "";
  }
  static getModuleParametersForTargetPlatform(targetPlatform) {
    let moduleArgument = "";
    switch (targetPlatform) {
      case "iOS":
        moduleArgument += `--module ios `;
        break;
      case "tvOS":
        moduleArgument += "--module tvos ";
        break;
      case "StandaloneOSX":
        moduleArgument += `--module mac-il2cpp `;
        break;
      case "Android":
        moduleArgument += `--module android `;
        break;
      case "WebGL":
        moduleArgument += "--module webgl ";
        break;
      default:
        throw new Error(`Unsupported module for target platform: ${targetPlatform}.`);
    }
    return moduleArgument;
  }
  static async installUnity(options, silent = false) {
    const moduleArgument = SetupMac.getModuleParametersForTargetPlatform(options.targetPlatform);
    const command2 = `${this.unityHubExecPath} -- --headless install                                           --version ${options.editorVersion}                                           ${moduleArgument}                                           --childModules `;
    try {
      await System.run(command2, undefined, { silent });
    } catch (error) {
      throw new Error(`There was an error installing the Unity Editor. See logs above for details. ${error}`);
    }
  }
  static setEnvironmentVariables(options) {
    process.env.ACTION_FOLDER = options.cliPath;
    process.env.UNITY_VERSION = options.editorVersion;
    process.env.UNITY_SERIAL = options.unitySerial;
    process.env.UNITY_LICENSING_SERVER = options.unityLicensingServer;
    process.env.PROJECT_PATH = options.projectPath;
    process.env.BUILD_TARGET = options.targetPlatform;
    process.env.BUILD_NAME = options.buildName;
    process.env.BUILD_PATH = options.buildPath;
    process.env.BUILD_FILE = options.buildFile;
    process.env.BUILD_METHOD = options.buildMethod;
    process.env.VERSION = options.buildVersion;
    process.env.ANDROID_VERSION_CODE = options.androidVersionCode;
    process.env.ANDROID_KEYSTORE_NAME = options.androidKeystoreName;
    process.env.ANDROID_KEYSTORE_BASE64 = options.androidKeystoreBase64;
    process.env.ANDROID_KEYSTORE_PASS = options.androidKeystorePass;
    process.env.ANDROID_KEYALIAS_NAME = options.androidKeyaliasName;
    process.env.ANDROID_KEYALIAS_PASS = options.androidKeyaliasPass;
    process.env.ANDROID_TARGET_SDK_VERSION = options.androidTargetSdkVersion;
    process.env.ANDROID_SDK_MANAGER_PARAMETERS = options.androidSdkManagerParameters;
    process.env.ANDROID_EXPORT_TYPE = options.androidExportType;
    process.env.ANDROID_SYMBOL_TYPE = options.androidSymbolType;
    process.env.CUSTOM_PARAMETERS = options.customParameters;
    process.env.CHOWN_FILES_TO = options.chownFilesTo;
  }
}

// src/logic/unity/platform-setup/setup-android.ts
init_dependencies();
import * as nodeFs3 from "node:fs";

class SetupAndroid {
  static async setup(options) {
    const { targetPlatform, androidKeystoreBase64, androidKeystoreName, projectPath } = options;
    if (targetPlatform === "Android" && androidKeystoreBase64 !== "" && androidKeystoreName !== "") {
      SetupAndroid.setupAndroidRun(androidKeystoreBase64, androidKeystoreName, projectPath);
    }
  }
  static setupAndroidRun(androidKeystoreBase64, androidKeystoreName, projectPath) {
    const decodedKeystore = Uint8Array.from(atob(androidKeystoreBase64), (c) => c.charCodeAt(0));
    const githubWorkspace = process.env.GITHUB_WORKSPACE || "";
    nodeFs3.writeFileSync(path.join(githubWorkspace, projectPath, androidKeystoreName), decodedKeystore);
  }
}

// src/logic/unity/platform-setup/platform-setup.ts
init_dependencies();
import * as nodeFs4 from "node:fs";

class PlatformSetup {
  static async setup(options) {
    const { hostPlatform } = options;
    if (!hostPlatform)
      throw new Error("hostPlatform is not defined");
    PlatformSetup.SetupShared(options);
    switch (hostPlatform) {
      case "win32":
        await SetupWindows.setup(options);
        break;
      case "darwin":
        await SetupMac.setup(options);
        break;
    }
  }
  static SetupShared(options) {
    const { cliDistPath, unityLicensingServer, unityLicensingToolset } = options;
    const servicesConfigPath = `${cliDistPath}/unity-config/services-config.json`;
    const servicesConfigPathTemplate = `${servicesConfigPath}.template`;
    if (!fsSyncCompat.existsSync(servicesConfigPathTemplate)) {
      log.error(`Missing services config ${servicesConfigPathTemplate}`);
      return;
    }
    let servicesConfig = nodeFs4.readFileSync(servicesConfigPathTemplate, "utf-8");
    servicesConfig = servicesConfig.replace("%URL%", unityLicensingServer);
    if (unityLicensingToolset) {
      const parsed = JSON.parse(servicesConfig);
      parsed.toolset = unityLicensingToolset;
      servicesConfig = JSON.stringify(parsed, undefined, 2);
    }
    nodeFs4.writeFileSync(servicesConfigPath, servicesConfig);
    SetupAndroid.setup(options);
  }
}

// src/model/mac-builder.ts
init_system();
init_unity_build_validation();
init_image_environment_factory();
init_environment();

class MacBuilder {
  static buildEnv(options) {
    const { currentWorkDir, cliDistPath } = options;
    const extraVariables = options.engine === "unity" ? UnityEnvironment.getVariables(options) : [];
    const variables = ImageEnvironmentFactory.getEnvironmentVariables(options, extraVariables);
    const env3 = {};
    for (const { name, value } of variables) {
      if (value === "" || value === undefined)
        continue;
      env3[name] = value.toString();
    }
    if (currentWorkDir)
      env3.GITHUB_WORKSPACE = currentWorkDir;
    if (cliDistPath)
      env3.ACTION_FOLDER = cliDistPath;
    return env3;
  }
  static async run(options, silent = false) {
    const { cliDistPath, engine } = options;
    log.warning("running the process");
    const macRun = await System.run(`bash ${cliDistPath}/platforms/mac/entrypoint.sh`, undefined, {
      silent,
      env: MacBuilder.buildEnv(options)
    });
    switch (engine) {
      case "unity":
        UnityBuildValidation.validateBuild(macRun.output);
        break;
    }
  }
}

// src/model/unity-logs.ts
init_dependencies();
import os from "node:os";
var PATHS = [
  {
    category: "editor-log",
    description: "Unity Editor.log",
    paths: {
      linux: ["$HOME/.config/unity3d/Editor.log"],
      darwin: ["$HOME/Library/Logs/Unity/Editor.log"],
      win32: ["$LOCALAPPDATA/Unity/Editor/Editor.log"]
    }
  },
  {
    category: "licensing-client",
    description: "Unity.Licensing.Client.log",
    paths: {
      linux: ["$HOME/.config/unity3d/Unity/Unity.Licensing.Client.log"],
      darwin: ["$HOME/Library/Logs/Unity/Unity.Licensing.Client.log"],
      win32: ["$LOCALAPPDATA/Unity/Unity.Licensing.Client.log"]
    }
  },
  {
    category: "entitlements-audit",
    description: "Unity.Entitlements.Audit.log",
    paths: {
      linux: ["$HOME/.config/unity3d/Unity/Unity.Entitlements.Audit.log"],
      darwin: ["$HOME/Library/Logs/Unity/Unity.Entitlements.Audit.log"],
      win32: ["$LOCALAPPDATA/Unity/Unity.Entitlements.Audit.log"]
    }
  },
  {
    category: "services-config",
    description: "services-config.json",
    paths: {
      linux: ["/usr/share/unity3d/config/services-config.json"],
      darwin: ["/Library/Application Support/Unity/config/services-config.json"],
      win32: ["$PROGRAMDATA/Unity/config/services-config.json"]
    }
  },
  {
    category: "build-report",
    description: "LastBuild.buildreport",
    workspaceRelative: true,
    paths: {
      linux: ["$PROJECT/Library/LastBuild.buildreport"],
      darwin: ["$PROJECT/Library/LastBuild.buildreport"],
      win32: ["$PROJECT/Library/LastBuild.buildreport"]
    }
  },
  {
    category: "bee-backend",
    description: "bee_backend.log",
    workspaceRelative: true,
    paths: {
      linux: ["$PROJECT/Library/Bee/bee_backend.log"],
      darwin: ["$PROJECT/Library/Bee/bee_backend.log"],
      win32: ["$PROJECT/Library/Bee/bee_backend.log"]
    }
  },
  {
    category: "project-version",
    description: "ProjectVersion.txt",
    workspaceRelative: true,
    paths: {
      linux: ["$PROJECT/ProjectSettings/ProjectVersion.txt"],
      darwin: ["$PROJECT/ProjectSettings/ProjectVersion.txt"],
      win32: ["$PROJECT/ProjectSettings/ProjectVersion.txt"]
    }
  },
  {
    category: "package-manifest",
    description: "Packages/manifest.json + packages-lock.json",
    workspaceRelative: true,
    paths: {
      linux: ["$PROJECT/Packages/manifest.json", "$PROJECT/Packages/packages-lock.json"],
      darwin: ["$PROJECT/Packages/manifest.json", "$PROJECT/Packages/packages-lock.json"],
      win32: ["$PROJECT/Packages/manifest.json", "$PROJECT/Packages/packages-lock.json"]
    }
  }
];

class UnityLogs {
  static collect(options) {
    const platform2 = options.platform || UnityLogs.detectPlatform();
    const env3 = options.env || process.env;
    const projectFullPath = path.isAbsolute(options.projectPath) ? options.projectPath : path.join(options.workspace, options.projectPath || "");
    const outputDir = options.outputDir || path.join(options.workspace, "Logs", "UnityDiagnostics");
    fsSyncCompat.mkdirSync(outputDir, { recursive: true });
    const filtered = options.categories && options.categories.length > 0 ? PATHS.filter((definition) => options.categories.includes(definition.category)) : PATHS.filter((definition) => !definition.sensitive || options.includeSensitive);
    const tokens = {
      HOME: env3.HOME || os.homedir(),
      USERPROFILE: env3.USERPROFILE || os.homedir(),
      LOCALAPPDATA: env3.LOCALAPPDATA || path.join(os.homedir(), "AppData", "Local"),
      APPDATA: env3.APPDATA || path.join(os.homedir(), "AppData", "Roaming"),
      PROGRAMDATA: env3.PROGRAMDATA || "C:/ProgramData",
      WORKSPACE: options.workspace,
      PROJECT: projectFullPath
    };
    const collected = [];
    const missing = [];
    for (const definition of filtered) {
      const templates = definition.paths[platform2] || [];
      let foundOne = false;
      for (const template of templates) {
        const sourcePath = template.replace(/\$([A-Z_]+)/g, (full, name) => tokens[name] !== undefined ? tokens[name] : full);
        if (!fsSyncCompat.existsSync(sourcePath))
          continue;
        try {
          const targetBase = path.join(outputDir, definition.category);
          fsSyncCompat.mkdirSync(targetBase, { recursive: true });
          const targetFile = path.join(targetBase, path.basename(sourcePath));
          fsSyncCompat.copyFileSync(sourcePath, targetFile);
          collected.push(`${definition.category}: ${sourcePath}`);
          foundOne = true;
        } catch (error) {
          log.warning(`[UnityLogs] copy failed for ${definition.category}: ${error.message}`);
        }
      }
      if (!foundOne)
        missing.push(definition.category);
    }
    const manifestPath = path.join(outputDir, "manifest.json");
    fsSyncCompat.writeFileSync(manifestPath, JSON.stringify({
      generatedAt: new Date().toISOString(),
      platform: platform2,
      projectPath: projectFullPath,
      collected,
      missing
    }, null, 2), "utf8");
    log.info(`[UnityLogs] collected ${collected.length} item(s) → ${outputDir}`);
    if (missing.length > 0) {
      log.info(`[UnityLogs] missing categories: ${missing.join(", ")}`);
    }
    return { outputDir, collected, missing };
  }
  static streamFiles(files) {
    const positions = new Map;
    const buffers = new Map;
    let stopped = false;
    const tick = () => {
      if (stopped)
        return;
      for (const file of files) {
        if (!fsSyncCompat.existsSync(file))
          continue;
        const stat = fsSyncCompat.statSync(file);
        const previous = positions.get(file) ?? 0;
        if (stat.size <= previous) {
          if (stat.size < previous)
            positions.set(file, 0);
          continue;
        }
        const buffer = Buffer.alloc(stat.size - previous);
        const fd = fsSyncCompat.openSync(file, "r");
        try {
          fsSyncCompat.readSync(fd, buffer, 0, buffer.length, previous);
        } finally {
          fsSyncCompat.closeSync(fd);
        }
        positions.set(file, stat.size);
        const text = (buffers.get(file) || "") + buffer.toString("utf8");
        const lines = text.split(/\r?\n/);
        const last = lines.pop();
        buffers.set(file, last || "");
        for (const line of lines) {
          if (line)
            log.info(`[UnityLogs] ${path.basename(file)}: ${line}`);
        }
      }
    };
    const interval = setInterval(tick, 1000);
    return () => {
      stopped = true;
      clearInterval(interval);
      tick();
    };
  }
  static detectPlatform() {
    if (process.platform === "darwin")
      return "darwin";
    if (process.platform === "win32")
      return "win32";
    return "linux";
  }
  static parseCategories(input) {
    if (!input)
      return;
    const trimmed = input.trim();
    if (!trimmed || trimmed === "all")
      return;
    return trimmed.split(",").map((s) => s.trim()).filter(Boolean);
  }
}

// src/command/build/unity-build-command.ts
init_dependencies();

// src/command-options/unity-options.ts
init_unity_target_platform();

// src/model/unity/target-platform/unity-target-platforms.ts
init_model();

class UnityTargetPlatforms {
  static all = [
    UnityTargetPlatform.Android,
    UnityTargetPlatform.iOS,
    UnityTargetPlatform.StandaloneLinux64,
    UnityTargetPlatform.StandaloneOSX,
    UnityTargetPlatform.StandaloneWindows,
    UnityTargetPlatform.StandaloneWindows64,
    UnityTargetPlatform.Switch,
    UnityTargetPlatform.tvOS,
    UnityTargetPlatform.WebGL,
    UnityTargetPlatform.WSAPlayer,
    UnityTargetPlatform.XboxOne,
    UnityTargetPlatform.Lumin,
    UnityTargetPlatform.BJM,
    UnityTargetPlatform.Stadia,
    UnityTargetPlatform.Facebook,
    UnityTargetPlatform.NoTarget,
    UnityTargetPlatform.Test
  ];
}

// src/model/unity/license/unity-license.ts
init_dependencies();

class UnityLicense {
  static licenseStartKey = '<DeveloperData Value="';
  static licenseEndKey = '"/>';
  static activatedLicenseExtension = ".ulf";
  static nonActivatedLicenseExtension = ".alf";
  static isNonActivatedLicenseFile(filePath) {
    return filePath.endsWith(UnityLicense.nonActivatedLicenseExtension);
  }
  static isValidLicenseFilePath(filePath) {
    return filePath.endsWith(UnityLicense.activatedLicenseExtension);
  }
  static isValidLicenseFileContents(fileContents) {
    return fileContents.includes(UnityLicense.licenseStartKey);
  }
  static getLicenseSerialFromUlf(fileContents) {
    const startIndex = fileContents.indexOf(UnityLicense.licenseStartKey) + UnityLicense.licenseStartKey.length;
    if (startIndex < 0) {
      throw new Error(`License File was corrupted, unable to locate serial`);
    }
    const endIndex = fileContents.indexOf(UnityLicense.licenseEndKey, startIndex);
    if (endIndex < 0) {
      throw new Error(`License File was corrupted, unable to locate serial`);
    }
    return new TextDecoder().decode(base64.decode(fileContents.slice(startIndex, endIndex))).slice(4);
  }
}

// src/command-options/unity-options.ts
import * as nodeFs5 from "node:fs";

class UnityOptions {
  static configure = async (yargs) => {
    await yargs.option("targetPlatform", {
      alias: "t",
      description: "The platform to build your project for",
      choices: UnityTargetPlatforms.all,
      demandOption: false,
      default: UnityTargetPlatform.default
    }).options({
      unityEmail: {
        alias: "u",
        description: "Email address for your Unity account",
        type: "string",
        demandOption: false,
        default: ""
      },
      unityPassword: {
        alias: "p",
        description: "Password for your Unity account",
        type: "string",
        demandOption: false,
        default: ""
      },
      unitySerial: {
        alias: "s",
        description: "Serial number identifying a pro-license seat",
        type: "string",
        demandOption: false,
        default: ""
      },
      unityLicense: {
        alias: "l",
        description: "Contents of, or path to your Unity License File (.ulf)",
        type: "string",
        demandOption: false,
        default: ""
      },
      unityLicensingServer: {
        alias: "ls",
        description: "Licensing server to use for Unity activation",
        type: "string",
        demandOption: false,
        default: ""
      },
      unityLicensingToolset: {
        alias: "lt",
        description: "Toolset identifier for floating-license servers that host multiple toolsets. Empty by default.",
        type: "string",
        demandOption: false,
        default: ""
      }
    }).coerce("unityLicense", async (arg) => {
      if (UnityLicense.isNonActivatedLicenseFile(arg)) {
        throw new Error(String.dedent`Unity License File (.ulf) expected, but got .alf.
          Please activate your license file first.`);
      }
      return UnityLicense.isValidLicenseFilePath(arg) ? nodeFs5.readFileSync(arg, "utf-8") : arg;
    }).option("customImage", {
      description: String.dedent`
          Custom docker image to use inside the command.
          For more information see https://game.ci/docs/docker/versions`,
      type: "string"
    }).option("usymUploadAuthToken", {
      description: "<missing description>",
      type: "string",
      demandOption: false,
      default: ""
    }).option("customParameters", {
      description: String.dedent`
          Custom parameters to configure the build.

          There are 2 main use cases for this option:
          - To pass your own custom parameters to be used with buildMethod above
          - To pass Unity Build Options (for example, customParameters: -EnableHeadlessMode will do server builds)
        `,
      type: "string",
      demandOption: false,
      default: ""
    }).option("sshAgent", {
      description: "SSH Agent path to forward to the container.",
      type: "string",
      demandOption: false,
      default: ""
    }).option("gitPrivateToken", {
      description: "Github private token to pull from github.",
      type: "string",
      demandOption: false,
      default: ""
    }).option("chownFilesTo", {
      description: String.dedent`
          User and optionally group (user or user:group or uid:gid),
          to give ownership of the resulting build artifacts.`,
      type: "string",
      demandOption: false,
      default: ""
    }).option("cacheUnityInstallationOnMac", {
      description: "Cache Unity installation on Mac.",
      type: "boolean",
      demandOption: false,
      default: false
    }).option("unityHubVersionOnMac", {
      description: String.dedent`Unity Hub version to use on Mac.
        Should be of format Major.Minor.Patch, ie 3.4.0.
        An empty string represents the latest available version on homebrew.`,
      type: "string",
      demandOption: false,
      default: ""
    });
  };
}

// src/model/versioning/versioning-strategies.ts
class VersioningStrategies {
  static get all() {
    return [VersioningStrategy.None, VersioningStrategy.Semantic, VersioningStrategy.Tag, VersioningStrategy.Custom];
  }
}
// src/middleware/build-versioning/index.ts
init_build_version_generator();

// src/middleware/build-versioning/android-build-version-generator.ts
init_dependencies();

class AndroidBuildVersionGenerator {
  static determineVersionCode(version) {
    if (version === "none") {
      log.info(`Versioning strategy is set to ${version}, so android version code should not be applied.`);
      return 0;
    }
    const parsedVersion = semver.parse(version);
    if (!parsedVersion) {
      log.warning(`Could not parse "${version}" to semver, defaulting android version code to 1`);
      return 1;
    }
    const versionCode = parsedVersion.major * 1e6 + parsedVersion.minor * 1000 + parsedVersion.patch;
    if (versionCode >= 2050000000) {
      throw new Error(`Generated versionCode ${versionCode} is dangerously close to the maximum allowed number 2100000000. Consider a different versioning scheme to be able to continue updating your application.`);
    }
    log.info(`Using android versionCode ${versionCode}`);
    return versionCode;
  }
}

// src/middleware/build-versioning/index.ts
var buildVersioning = async (argv) => {
  const { projectPath, currentBranch, versioningStrategy, version, allowDirtyBuild, androidVersionCode, buildVersion } = argv;
  const buildVersionGenerator = new BuildVersionGenerator(projectPath, currentBranch);
  argv.buildVersion = await buildVersionGenerator.determineBuildVersion(versioningStrategy, version, allowDirtyBuild);
  if (!androidVersionCode) {
    argv.androidVersionCode = AndroidBuildVersionGenerator.determineVersionCode(argv.buildVersion);
  }
};

// src/command-options/versioning-options.ts
class VersioningOptions {
  static async configure(yargs) {
    yargs.option("versioningStrategy", {
      description: "Versioning strategy",
      choices: VersioningStrategies.all,
      demandOption: false,
      default: VersioningStrategy.Semantic
    }).option("version", {
      description: String.dedent`
          Custom version to use for the build.
          Only used when versioningStrategy is set to Custom`,
      type: "string",
      default: ""
    }).option("androidVersionCode", {
      description: String.dedent`
          Custom version code for android specifically.`,
      type: "string",
      default: ""
    }).option("allowDirtyBuild", {
      description: "Allow a dirty build",
      type: "boolean",
      demandOption: false,
      default: false
    }).default("buildVersion", "placeholder").middleware([buildVersioning]);
  }
}

// src/command-options/build-options.ts
init_unity_target_platform();
import * as os2 from "node:os";
function defaultDockerMemoryLimit() {
  const bytesInMegabyte = 1024 * 1024;
  let memoryMultiplier;
  switch (os2.platform()) {
    case "linux":
      memoryMultiplier = 0.95;
      break;
    case "win32":
      memoryMultiplier = 0.8;
      break;
    default:
      memoryMultiplier = 0.75;
      break;
  }
  return `${Math.floor(os2.totalmem() / bytesInMegabyte * memoryMultiplier)}m`;
}

class BuildOptions {
  static configure(yargs) {
    yargs.demandOption("targetPlatform", "Target platform is mandatory for builds").option("buildName", {
      description: "Name of the build (defaults to targetPlatform name)",
      type: "string",
      demandOption: false,
      default: ""
    }).option("buildsPath", {
      alias: "o",
      description: "Output folder for the builds",
      type: "string",
      demandOption: false,
      default: "build"
    }).default("buildPath", "").default("buildFile", "").middleware((argv) => {
      const { buildName, buildsPath, targetPlatform, androidAppBundle, androidExportType, linux64RemoveExecutableExtension } = argv;
      const resolvedBuildName = buildName || targetPlatform;
      const resolvedAndroidExportType = androidExportType || (androidAppBundle ? "androidAppBundle" : "androidPackage");
      argv.buildName = resolvedBuildName;
      argv.buildPath = `${buildsPath}/${targetPlatform}`;
      argv.buildFile = UnityTargetPlatform.determineBuildFileName(resolvedBuildName, targetPlatform, resolvedAndroidExportType, Boolean(linux64RemoveExecutableExtension));
    }).option("buildMethod", {
      alias: "m",
      description: "Build method to use",
      type: "string",
      demandOption: false,
      default: "UnityBuilderAction.Builder.BuildProject"
    }).option("dockerWorkspacePath", {
      description: String.dedent`The path to mount the workspace inside the docker container. For windows, leave out the drive letter. For example
        c:/github/workspace should be defined as /github/workspace`,
      type: "string",
      demandOption: false,
      default: "/github/workspace"
    }).option("manualExit", {
      description: String.dedent`Skip passing -quit to the Unity editor, so it stays open after the build method returns.
        Use this if your build method needs to run further code in play mode before exiting (see
        https://github.com/game-ci/cli/issues/13). Your build method must call EditorApplication.Exit(0) itself,
        otherwise the build will hang until it times out.`,
      type: "boolean",
      demandOption: false,
      default: false
    }).option("buildProfile", {
      description: String.dedent`Path to a Unity 6 Build Profile asset (relative to the project), used instead of
        --targetPlatform to determine the build's target and settings.`,
      type: "string",
      demandOption: false,
      default: ""
    }).option("skipActivation", {
      description: String.dedent`Skip the license activation and return-license steps entirely. Useful when a
        license is already active in a long-lived container (e.g. some self-hosted runner setups).`,
      type: "boolean",
      demandOption: false,
      default: false
    }).option("runAsHostUser", {
      description: String.dedent`Linux only. Run the build as a user matching the host system's UID/GID instead of
        the container's default root user, so build artifacts aren't left root-owned on the host. Useful for
        fixing permission errors on self-hosted runners.`,
      type: "boolean",
      demandOption: false,
      default: false
    }).option("enableGpu", {
      description: String.dedent`Windows only. Installs a Mesa llvmpipe software graphics driver before the build,
        for GPU-less compute-shader/graphics testing.`,
      type: "boolean",
      demandOption: false,
      default: false
    }).option("gitConfigExtensions", {
      description: String.dedent`Linux only. Newline-separated list of extra git config entries to set before the
        build, in "key=value" form (e.g. for LFS/submodule auth setups not covered by gitPrivateToken).`,
      type: "string",
      demandOption: false,
      default: ""
    }).option("linux64RemoveExecutableExtension", {
      description: String.dedent`When building for StandaloneLinux64, remove the default .x86_64 file extension
        Unity appends to the build's executable.`,
      type: "boolean",
      demandOption: false,
      default: false
    }).option("useHostNetwork", {
      description: "Linux only. Initialises Docker using the host network.",
      type: "boolean",
      demandOption: false,
      default: false
    }).option("dockerCpuLimit", {
      description: "Number of CPU cores to assign the docker container. Defaults to all available cores.",
      type: "string",
      demandOption: false,
      default: os2.cpus().length.toString()
    }).option("dockerMemoryLimit", {
      description: String.dedent`Amount of memory to assign the docker container. Defaults to 95% of total system
        memory rounded down to the nearest megabyte on Linux and 80% on Windows. On unrecognized platforms, defaults
        to 75% of total system memory. To manually specify a value, use the format <number><unit>, where unit is
        either m or g. ie: 512m = 512 megabytes`,
      type: "string",
      demandOption: false,
      default: defaultDockerMemoryLimit()
    }).option("dockerIsolationMode", {
      description: String.dedent`Windows only. Isolation mode to use for the docker container. Can be one of
        process, hyperv, or default. Default will pick the default mode as described by Microsoft where server
        versions use process and desktop versions use hyperv.`,
      type: "string",
      demandOption: false,
      default: "default"
    }).option("containerRegistryRepository", {
      description: "Container registry and repository to pull the Unity editor image from. Only applies if customImage is not set.",
      type: "string",
      demandOption: false,
      default: "unityci/editor"
    }).option("containerRegistryImageVersion", {
      description: "Container registry image rolling version. Only applies if customImage is not set.",
      type: "string",
      demandOption: false,
      default: "3"
    }).option("sshPublicKeysDirectoryPath", {
      description: "Path to a directory containing SSH public keys to forward to the container.",
      type: "string",
      demandOption: false,
      default: ""
    });
  }
}

// src/command-options/android-options.ts
class AndroidOptions {
  static configure(yargs) {
    yargs.options({
      androidAppBundle: {
        description: "Build an Android App Bundle",
        type: "boolean",
        demandOption: false,
        deprecated: "Use androidExportType instead"
      },
      androidExportType: {
        description: "Export type for Android Build",
        type: "string",
        demandOption: false,
        choices: ["androidPackage", "androidAppBundle", "androidStudioProject"],
        conflicts: ["androidAppBundle"],
        default: "androidPackage"
      }
    }).middleware([AndroidOptions.determineExportType]).option("androidSymbolType", {
      description: "Debug symbol type to export with Android build",
      type: "string",
      demandOption: false,
      choices: ["none", "public", "debugging"],
      default: "none"
    }).options({
      androidKeystoreName: {
        description: "Name of the keystore",
        type: "string",
        demandOption: false,
        default: ""
      },
      androidKeystoreBase64: {
        description: "Base64 encoded contents of the keystore",
        type: "string",
        demandOption: false,
        default: ""
      },
      androidKeystorePass: {
        description: "Password for the keystore",
        type: "string",
        demandOption: false,
        default: "",
        deprecated: "Use androidKeystorePassword instead"
      },
      androidKeystorePassword: {
        description: "Password for the keystore",
        type: "string",
        demandOption: false,
        default: ""
      },
      androidKeyAlias: {
        description: "Alias for the keystore",
        type: "string",
        demandOption: false,
        default: ""
      },
      androidKeyAliasName: {
        description: "Name of the keystore",
        type: "string",
        demandOption: false,
        default: "",
        deprecated: "Use androidKeyAlias instead"
      },
      androidKeyAliasPassword: {
        description: "Password for the androidKeyAlias",
        type: "string",
        demandOption: false,
        default: "",
        requires: ["androidKeyAlias"]
      },
      androidKeyAliasPass: {
        description: "Password for the androidKeyAlias",
        type: "string",
        demandOption: false,
        default: "",
        deprecated: "Use androidKeyAliasPassword instead"
      }
    }).option("androidTargetSdkVersion", {
      description: "Custom Android SDK target version",
      type: "number",
      demandOption: false,
      default: ""
    }).default("androidSdkManagerParameters", "").middleware([AndroidOptions.determineSdkManagerParameters]);
  }
  static determineSdkManagerParameters(argv) {
    const { androidTargetSdkVersion } = argv;
    if (!androidTargetSdkVersion)
      return;
    argv.androidSdkManagerParameters = `platforms;android-${androidTargetSdkVersion}`;
  }
  static determineExportType(argv) {
    const { androidAppBundle } = argv;
    if (androidAppBundle) {
      argv.androidExportType = "androidAppBundle";
    }
  }
}

// src/command-options/unity-logs-options.ts
class UnityLogsOptions {
  static configure(yargs) {
    yargs.option("collectUnityLogs", {
      description: String.dedent`
          Collect Unity-internal logs (Editor.log, Unity.Licensing.Client.log,
          Unity.Entitlements.Audit.log, services-config.json, …) into the
          workspace after the build so they can be uploaded as artifacts.
          Useful when Unity support requests these files.`,
      type: "boolean",
      demandOption: false,
      default: false
    }).option("collectUnityLogsOnSuccess", {
      description: "Also collect Unity logs on successful builds (default true).",
      type: "boolean",
      demandOption: false,
      default: true
    }).option("unityLogCategories", {
      description: String.dedent`
          Comma-separated subset of categories to collect. Default = all
          non-sensitive categories. See orchestrator docs for the full list.`,
      type: "string",
      demandOption: false,
      default: ""
    }).option("unityLogsIncludeSensitive", {
      description: "Include sensitive categories like license-file. Off by default.",
      type: "boolean",
      demandOption: false,
      default: false
    }).option("unityLogsOutputDir", {
      description: "Override the directory for collected Unity logs. Default <workspace>/Logs/UnityDiagnostics.",
      type: "string",
      demandOption: false,
      default: ""
    }).option("streamUnityLogs", {
      description: "Live-tail Unity log files during the build and forward each line to stdout.",
      type: "boolean",
      demandOption: false,
      default: false
    }).option("streamUnityLogPaths", {
      description: "Comma-separated files to live-tail. Defaults to <project>/Builds/Logs/Editor.log.",
      type: "string",
      demandOption: false,
      default: ""
    });
  }
}

// src/logic/unity/platform-validation/platform-validation.ts
class PlatformValidation {
  static get supportedPlatforms() {
    return ["linux", "win32", "darwin"];
  }
  static checkCompatibility(options) {
    const { hostPlatform, hostOS } = options;
    if (!PlatformValidation.supportedPlatforms.includes(hostPlatform)) {
      throw new Error(`Currently ${hostOS} (${hostPlatform}) is not supported`);
    }
  }
}

// src/command/build/unity-build-command.ts
class UnityBuildCommand extends CommandBase {
  async execute(options) {
    const { hostPlatform } = options;
    PlatformValidation.checkCompatibility(options);
    CacheValidation.verify(options);
    const image = new RunnerImageTag(options);
    if (log.isVerbose)
      log.debug("Using image:", image);
    await PlatformSetup.setup(options);
    let stopTail;
    if (options.streamUnityLogs) {
      const projectDir = options.projectPath || options.workspace || process.cwd();
      const explicit = String(options.streamUnityLogPaths || "").split(",").map((s) => s.trim()).filter(Boolean);
      const defaults = [path.join(projectDir, "Builds", "Logs", "Editor.log")];
      stopTail = UnityLogs.streamFiles(explicit.length > 0 ? explicit : defaults);
      log.info("[UnityLogs] Live log streaming started");
    }
    let buildError;
    let buildSucceeded = true;
    try {
      await log.group("Unity build", async () => {
        if (hostPlatform === "darwin") {
          await MacBuilder.run(options);
        } else {
          await Docker.run(image.toString(), options);
        }
      });
    } catch (error) {
      buildError = error;
      buildSucceeded = false;
    } finally {
      if (stopTail) {
        try {
          stopTail();
        } catch {}
      }
    }
    if (options.collectUnityLogs && (!buildSucceeded || options.collectUnityLogsOnSuccess !== false)) {
      try {
        const projectDir = options.projectPath || options.workspace || process.cwd();
        const workspace = options.workspace || projectDir;
        UnityLogs.collect({
          workspace,
          projectPath: projectDir,
          outputDir: options.unityLogsOutputDir || undefined,
          categories: UnityLogs.parseCategories(options.unityLogCategories),
          includeSensitive: !!options.unityLogsIncludeSensitive
        });
      } catch (collectError) {
        log.warning(`[UnityLogs] collection failed: ${collectError.message}`);
      }
    }
    if (buildError)
      throw buildError;
    await Output.setBuildVersion(options.buildVersion);
    await Output.setAndroidVersionCode(options.androidVersionCode);
    return true;
  }
  async configureOptions(yargs) {
    await ProjectOptions.configure(yargs);
    await UnityOptions.configure(yargs);
    await VersioningOptions.configure(yargs);
    await BuildOptions.configure(yargs);
    await AndroidOptions.configure(yargs);
    await UnityLogsOptions.configure(yargs);
  }
}

// src/command-options/remote-options.ts
class RemoteOptions {
  static async configure(yargs) {
    yargs.option("providerStrategy", {
      description: `Provider strategy for orchestrated jobs (${PluginRegistry.getAvailableProviders().join(", ") || "none registered"})`,
      type: "string",
      demandOption: false,
      default: "local-docker"
    });
    yargs.option("customJob", {
      description: "Custom job to run",
      type: "string",
      demandOption: false,
      default: ""
    });
    const engine = yargs.parsed?.argv?.engine || "*";
    await PluginRegistry.configureOptions(engine, yargs);
  }
}

// src/command/orchestrate/unity-orchestrate-command.ts
class UnityOrchestrateCommand extends CommandBase {
  async execute(options) {
    const { providerStrategy } = options;
    const provider = PluginRegistry.createProvider(providerStrategy, options);
    if (!provider) {
      throw new Error(`No provider registered for strategy "${providerStrategy}". ` + `Available: ${PluginRegistry.getAvailableProviders().join(", ") || "none"}. ` + `Install a provider plugin (e.g. @game-ci/orchestrator-plugin).`);
    }
    log.info(`Using provider strategy: ${providerStrategy}`);
    const result = await provider.runTaskInWorkflow("", "", "", "", "", [], []);
    log.info("Orchestrated job result:", result);
    return true;
  }
  async configureOptions(yargs) {
    await ProjectOptions.configure(yargs);
    await RemoteOptions.configure(yargs);
  }
}

// src/command/logs/unity-logs-command.ts
class UnityLogsCommand extends CommandBase {
  subCommand;
  constructor(commandName, subCommand) {
    super(commandName);
    this.subCommand = subCommand || "collect";
  }
  async execute(options) {
    switch (this.subCommand) {
      case "collect":
        return this.runCollect(options);
      case "tail":
        return this.runTail(options);
      case "pull":
        log.warning("[logs pull] Remote provider pulls are not implemented yet. " + "For now, ssh into the runner and run `game-ci logs collect` directly. " + "Tracking: https://github.com/game-ci/orchestrator/issues");
        return false;
      case "fetch":
        log.warning("[logs fetch] Retroactive fetch from past orchestrator builds is not implemented yet. " + "For now, the diagnostic bundle is uploaded as a build artifact when collectUnityLogs=true. " + "Tracking: https://github.com/game-ci/orchestrator/issues");
        return false;
      default:
        log.error(`Unknown logs subcommand: ${this.subCommand}. ` + `Valid subcommands: collect, tail, pull, fetch.`);
        return false;
    }
  }
  async configureOptions(yargs) {
    yargs.option("projectPath", {
      description: "Path to the Unity project (defaults to cwd).",
      type: "string",
      demandOption: false,
      default: ""
    }).option("workspace", {
      description: "Workspace root (defaults to projectPath or cwd).",
      type: "string",
      demandOption: false,
      default: ""
    });
    await UnityLogsOptions.configure(yargs);
  }
  async runCollect(options) {
    const workspace = options.workspace || options.projectPath || process.cwd();
    const projectPath = options.projectPath || workspace;
    const result = UnityLogs.collect({
      workspace,
      projectPath,
      outputDir: options.unityLogsOutputDir || undefined,
      categories: UnityLogs.parseCategories(options.unityLogCategories),
      includeSensitive: !!options.unityLogsIncludeSensitive
    });
    log.info(`[logs collect] Collected ${result.collected.length} item(s) → ${result.outputDir}`);
    if (result.missing.length > 0) {
      log.info(`[logs collect] Missing categories on this host: ${result.missing.join(", ")}`);
    }
    return true;
  }
  async runTail(options) {
    const projectPath = options.projectPath || options.workspace || process.cwd();
    const explicit = String(options.streamUnityLogPaths || "").split(",").map((s) => s.trim()).filter(Boolean);
    const defaults = [`${projectPath}/Builds/Logs/Editor.log`];
    const files = explicit.length > 0 ? explicit : defaults;
    log.info(`[logs tail] Tailing ${files.length} file(s) — Ctrl+C to stop`);
    const stop = UnityLogs.streamFiles(files);
    const onSignal = (signal) => {
      stop();
      process.exit(signal === "SIGINT" ? 130 : 143);
    };
    process.on("SIGINT", onSignal);
    process.on("SIGTERM", onSignal);
    return new Promise(() => {});
  }
}

// src/model/unity-cli-adapter.ts
init_system();

class UnityCliAdapter {
  static async isAvailable() {
    try {
      const result = await System.run("unity --version", undefined, { silent: true });
      return result.status?.success ?? false;
    } catch {
      return false;
    }
  }
  static async installEditor(version, modules = []) {
    const moduleArgs = modules.flatMap((m) => ["-m", m]);
    const command2 = ["unity", "install", version, ...moduleArgs].join(" ");
    const result = await System.run(command2, undefined, { silent: true });
    return { success: result.status?.success ?? false, output: result.output };
  }
  static async installModules(editorVersion, modules) {
    const moduleArgs = modules.flatMap((m) => ["-m", m]);
    const command2 = ["unity", "install-modules", "-e", editorVersion, ...moduleArgs].join(" ");
    const result = await System.run(command2, undefined, { silent: true });
    return { success: result.status?.success ?? false, output: result.output };
  }
  static async runCommand(command2, extraArgs = []) {
    const cliCommand = ["unity", "run", "--command", command2, ...extraArgs].join(" ");
    const result = await System.run(cliCommand, undefined, { silent: true });
    return { success: result.status?.success ?? false, output: result.output };
  }
  static async test(extraArgs = []) {
    const cliCommand = ["unity", "test", ...extraArgs].join(" ");
    const result = await System.run(cliCommand, undefined, { silent: true });
    return { success: result.status?.success ?? false, output: result.output };
  }
}

// src/command-options/unity-run-options.ts
class UnityRunOptions {
  static configure(yargs) {
    yargs.option("command", {
      alias: "c",
      description: String.dedent`
          Fully-qualified static method to invoke, e.g. MyNamespace.MyClass.MyMethod.
          Passed through to Unity CLI's \`run --command\` — see
          docs.unity.com/en-us/unity-cli for the current syntax.`,
      type: "string",
      demandOption: true
    }).option("unityCliArgs", {
      description: "Additional raw arguments appended to the underlying `unity run` invocation, space-separated.",
      type: "string",
      demandOption: false,
      default: ""
    });
  }
}

// src/command/run/unity-run-command.ts
class UnityRunCommand extends CommandBase {
  async execute(options) {
    const command2 = options.command;
    const extraArgs = String(options.unityCliArgs || "").split(" ").map((arg) => arg.trim()).filter(Boolean);
    const available = await UnityCliAdapter.isAvailable();
    if (!available) {
      throw new Error("run: requires Unity's official `unity` CLI binary on PATH " + "(https://docs.unity.com/en-us/unity-cli). Not found in this environment.");
    }
    try {
      const result = await UnityCliAdapter.runCommand(command2, extraArgs);
      log.info(result.output);
      return result.success;
    } catch (error) {
      throw new Error(`run: 'unity run --command ${command2}' failed — ${error.message}`);
    }
  }
  async configureOptions(yargs) {
    UnityRunOptions.configure(yargs);
  }
}

// src/command-options/unity-test-options.ts
class UnityTestOptions {
  static configure(yargs) {
    yargs.option("unityCliArgs", {
      description: String.dedent`
        Raw arguments passed through to \`unity test\` verbatim, space-separated.
        Unity's own CLI reference doesn't publish a flag table for this command;
        run \`unity test --help\` on the installed binary for the authoritative
        list (see docs.unity.com/en-us/unity-cli).`,
      type: "string",
      demandOption: false,
      default: ""
    });
  }
}

// src/command/test/unity-test-command.ts
class UnityTestCommand extends CommandBase {
  async execute(options) {
    const extraArgs = String(options.unityCliArgs || "").split(" ").map((arg) => arg.trim()).filter(Boolean);
    const available = await UnityCliAdapter.isAvailable();
    if (!available) {
      throw new Error("test: requires Unity's official `unity` CLI binary on PATH " + "(https://docs.unity.com/en-us/unity-cli). Not found in this environment.");
    }
    try {
      const result = await UnityCliAdapter.test(extraArgs);
      log.info(result.output);
      return result.success;
    } catch (error) {
      throw new Error(`test: 'unity test' failed: ${error.message}`);
    }
  }
  async configureOptions(yargs) {
    await UnityTestOptions.configure(yargs);
  }
}

// src/plugin/builtin/unity-plugin.ts
var unityPlugin = {
  name: "unity",
  version: "1.0.0",
  engineDetectors: [
    {
      name: "unity",
      detect(projectPath) {
        if (UnityVersionDetector.isUnityProject(projectPath)) {
          const engineVersion = UnityVersionDetector.getUnityVersion(projectPath);
          return { engine: "unity", engineVersion };
        }
        return null;
      }
    }
  ],
  commands: [
    {
      engine: "unity",
      createCommand(command2, subCommands) {
        switch (command2) {
          case "build":
            return new UnityBuildCommand(command2);
          case "orchestrate":
            return new UnityOrchestrateCommand(command2);
          case "run":
            return new UnityRunCommand(command2);
          case "test":
            return new UnityTestCommand(command2);
          case "remote":
            switch (subCommands[0]) {
              case "run":
              case "build":
                return new UnityOrchestrateCommand(command2);
              default:
                return new NonExistentCommand([command2, ...subCommands].join(" "));
            }
          case "logs":
            switch (subCommands[0]) {
              case "collect":
              case "tail":
              case "pull":
              case "fetch":
              case undefined:
              case "":
                return new UnityLogsCommand(command2, subCommands[0] || "collect");
              default:
                return new NonExistentCommand([command2, ...subCommands].join(" "));
            }
          default:
            return null;
        }
      }
    }
  ]
};

// src/middleware/engine-detection/godot-version-detector.ts
init_dependencies();
import * as nodeFs6 from "node:fs";

class GodotVersionDetector {
  static get versionPattern() {
    return /\d+\.\d+(?:\.\d+)?/;
  }
  static isGodotProject(projectPath) {
    const filePath = path.join(projectPath, "project.godot");
    return fsSyncCompat.existsSync(filePath);
  }
  static getGodotVersion(projectPath) {
    return GodotVersionDetector.read(projectPath);
  }
  static read(projectPath) {
    const filePath = path.join(projectPath, "project.godot");
    if (!fsSyncCompat.existsSync(filePath)) {
      throw new Error(`Godot project file not found at "${filePath}". Have you correctly set the projectPath?`);
    }
    return GodotVersionDetector.parse(nodeFs6.readFileSync(filePath, "utf-8"));
  }
  static parse(projectGodot) {
    const featuresMatch = projectGodot.match(/config\/features\s*=\s*PackedStringArray\("(\d+\.\d+)"/);
    if (featuresMatch) {
      return featuresMatch[1];
    }
    const compatMatch = projectGodot.match(/config\/features\s*=.*?(\d+\.\d+(?:\.\d+)?)/);
    if (compatMatch) {
      return compatMatch[1];
    }
    throw new Error("Failed to parse Godot version from project.godot");
  }
}

// src/command/build/godot-build-command.ts
class GodotBuildCommand extends CommandBase {
  async execute(options) {
    const projectPath = options.projectPath || ".";
    const exportPreset = options.exportPreset || "Linux/X11";
    const outputPath = options.outputPath || "build/game";
    const godotImage = options.customImage || `barichello/godot-ci:${options.engineVersion || "4.3"}`;
    log.info(`Building Godot project at ${projectPath}`);
    log.info(`Using image: ${godotImage}`);
    log.info(`Export preset: ${exportPreset}`);
    const { Docker: Docker2 } = await Promise.resolve().then(() => (init_model(), exports_model));
    await log.group("Godot export", async () => {
      await Docker2.run(godotImage, {
        ...options,
        commands: `godot --headless --verbose --export-release "${exportPreset}" ${outputPath}`
      });
    });
    return true;
  }
  async configureOptions(yargs) {
    await ProjectOptions.configure(yargs);
    yargs.option("exportPreset", {
      alias: "export-preset",
      describe: "Godot export preset name",
      type: "string",
      default: "Linux/X11"
    });
    yargs.option("outputPath", {
      alias: "output-path",
      describe: "Build output path",
      type: "string",
      default: "build/game"
    });
  }
}

// src/plugin/builtin/godot-plugin.ts
var godotPlugin = {
  name: "godot",
  version: "1.0.0",
  engineDetectors: [
    {
      name: "godot",
      detect(projectPath) {
        if (GodotVersionDetector.isGodotProject(projectPath)) {
          const engineVersion = GodotVersionDetector.getGodotVersion(projectPath);
          return { engine: "godot", engineVersion };
        }
        return null;
      }
    }
  ],
  commands: [
    {
      engine: "godot",
      createCommand(command2, subCommands) {
        switch (command2) {
          case "build":
            return new GodotBuildCommand(command2);
          default:
            return null;
        }
      }
    }
  ]
};

// src/middleware/engine-detection/unreal-project-detector.ts
init_dependencies();
import * as nodeFs7 from "node:fs";

class UnrealProjectDetector {
  static isUnrealProject(projectPath) {
    const uprojectFiles = UnrealProjectDetector.findUprojectFile(projectPath);
    return uprojectFiles !== null;
  }
  static getUnrealVersion(projectPath) {
    return UnrealProjectDetector.read(projectPath);
  }
  static findUprojectFile(projectPath) {
    try {
      const files = nodeFs7.readdirSync(projectPath);
      const uproject = files.find((f) => f.endsWith(".uproject"));
      return uproject ? path.join(projectPath, uproject) : null;
    } catch {
      return null;
    }
  }
  static read(projectPath) {
    const filePath = UnrealProjectDetector.findUprojectFile(projectPath);
    if (!filePath) {
      throw new Error(`No .uproject file found in "${projectPath}". Have you correctly set the projectPath?`);
    }
    return UnrealProjectDetector.parse(nodeFs7.readFileSync(filePath, "utf-8"));
  }
  static parse(uprojectContent) {
    const json = JSON.parse(uprojectContent);
    if (json.EngineAssociation) {
      return json.EngineAssociation;
    }
    throw new Error("Failed to parse Unreal Engine version from .uproject file");
  }
}

// src/command/build/unreal-build-command.ts
class UnrealBuildCommand extends CommandBase {
  async execute(options) {
    const projectPath = options.projectPath || ".";
    const targetPlatform = options.targetPlatform || "Linux";
    const buildConfig = options.buildConfig || "Shipping";
    const customImage = options.customImage;
    if (!customImage) {
      throw new Error("Unreal Engine builds require a custom Docker image. " + "Use --custom-image to specify your UE image (e.g., ghcr.io/epicgames/unreal-engine:5.4).");
    }
    log.info(`Building Unreal project at ${projectPath}`);
    log.info(`Using image: ${customImage}`);
    log.info(`Target platform: ${targetPlatform}, Config: ${buildConfig}`);
    const { Docker: Docker2 } = await Promise.resolve().then(() => (init_model(), exports_model));
    await log.group("Unreal build", () => Docker2.run(customImage, {
      ...options,
      commands: [
        "/home/ue4/UnrealEngine/Engine/Build/BatchFiles/RunUAT.sh",
        "BuildCookRun",
        `-project=/build/${projectPath}`,
        `-targetplatform=${targetPlatform}`,
        `-clientconfig=${buildConfig}`,
        "-build",
        "-cook",
        "-stage",
        "-pak",
        "-archive",
        "-archivedirectory=/build/output",
        "-noP4",
        "-unattended"
      ].join(" ")
    }));
    return true;
  }
  async configureOptions(yargs) {
    await ProjectOptions.configure(yargs);
    yargs.option("targetPlatform", {
      alias: "target-platform",
      describe: "UE target platform",
      type: "string",
      default: "Linux"
    });
    yargs.option("buildConfig", {
      alias: "build-config",
      describe: "UE build configuration (Development, Shipping, etc.)",
      type: "string",
      default: "Shipping"
    });
    yargs.option("customImage", {
      alias: "custom-image",
      describe: "Docker image for UE builds (required)",
      type: "string"
    });
  }
}

// src/plugin/builtin/unreal-plugin.ts
var unrealPlugin = {
  name: "unreal",
  version: "1.0.0",
  engineDetectors: [
    {
      name: "unreal",
      detect(projectPath) {
        if (UnrealProjectDetector.isUnrealProject(projectPath)) {
          const engineVersion = UnrealProjectDetector.getUnrealVersion(projectPath);
          return { engine: "unreal", engineVersion };
        }
        return null;
      }
    }
  ],
  commands: [
    {
      engine: "unreal",
      createCommand(command2, subCommands) {
        switch (command2) {
          case "build":
            return new UnrealBuildCommand(command2);
          default:
            return null;
        }
      }
    }
  ]
};

// src/cli.ts
class Cli {
  yargs;
  cliStoragePath;
  cliStorageCanonicalPath;
  cliPath;
  cliDistPath;
  configFileName;
  currentWorkDir;
  homeDir;
  isRunningLocally;
  hostPlatform;
  hostOS;
  command;
  constructor(args, cwd) {
    this.yargs = yargs_default(args);
    this.currentWorkDir = cwd;
    this.configFileName = ".game-ci.yml";
    this.homeDir = getHomeDir() || "";
    this.cliStoragePath = `${this.homeDir}/.game-ci`;
    this.cliStorageCanonicalPath = "~/.game-ci";
    this.isRunningLocally = !Boolean(process2.env.CI);
    this.command = new NonExistentCommand("non-existent");
    this.hostPlatform = process2.platform;
    this.hostOS = process2.platform === "win32" ? "windows" : process2.platform;
    this.cliPath = __dirname3;
    this.cliDistPath = path.join(path.dirname(__dirname3), "dist");
  }
  async setup() {
    await this.configureLogger();
    await this.configureGlobalSettings();
    await this.configureGlobalOptions();
    await this.loadPlugins();
  }
  async loadPlugins() {
    await PluginRegistry.registerOnce(unityPlugin);
    await PluginRegistry.registerOnce(godotPlugin);
    await PluginRegistry.registerOnce(unrealPlugin);
    const options = await this.getPreCommandOptions();
    const pluginSources = this.getPluginSources(options);
    if (pluginSources.length === 0) {
      return;
    }
    await PluginLoader.loadAll(pluginSources);
  }
  async registerCommands() {
    await this.nonStrict(async () => {
      const register = (yargs) => yargs.middleware([this.registerCommand.bind(this)]);
      await new CliCommands(this.yargs, register).registerAll();
      await this.yargs.parseAsync();
    });
  }
  async registerSchemaForChosenCommand() {
    await this.command.configureOptions(this.yargs);
  }
  async validateAndParseArguments() {
    const options = await this.finalParse();
    if (log.isVeryVerbose) {
      console.log("cliPath", this.cliPath);
      console.log("distPath", this.cliDistPath);
    }
    return {
      command: this.command,
      options
    };
  }
  async configureLogger() {
    await this.nonStrict(async () => {
      await this.yargs.options("quiet", {
        alias: "q",
        description: "Suppress all output",
        type: "boolean",
        demandOption: false,
        default: false
      }).options("verbose", {
        alias: "v",
        description: "Enable verbose logging",
        type: "boolean",
        demandOption: false,
        default: false
      }).options("veryVerbose", {
        alias: "vv",
        description: "Enable very verbose logging",
        type: "boolean",
        demandOption: false,
        default: false
      }).options("maxVerbose", {
        alias: "vvv",
        description: "Enable debug logging",
        demandOption: false,
        type: "boolean",
        default: false
      }).default([{ logLevel: "placeholder" }, { logLevelName: "placeholder" }]).middleware([configureLogger2], true).parseAsync();
    });
  }
  configureGlobalSettings() {
    const defaultCanonicalPath = `${this.cliStorageCanonicalPath}/${this.configFileName}`;
    this.yargs.parserConfiguration({
      "dot-notation": false,
      "duplicate-arguments-array": false,
      "negation-prefix": false,
      "strip-aliased": true,
      "strip-dashed": true
    }).fail(Cli.handleFailure).help(false).version(false).showHelpOnFail(false).epilogue("for more information, find our manual at https://game.ci/docs/cli").middleware([]).exitProcess(true).strict(true);
  }
  configureGlobalOptions() {
    const defaultAbsolutePath = `${this.cliStoragePath}/${this.configFileName}`;
    this.yargs.option("plugin", {
      description: "Load an external plugin from npm, a local path, github:<repo>, or executable:<path>",
      type: "string",
      array: true
    }).option("plugins", {
      description: "Alias for --plugin to support config-driven plugin arrays",
      type: "string",
      array: true
    }).config("config", `default: .game-ci.yml`, (override) => {
      const configPath = override || defaultAbsolutePath;
      return this.loadConfig(configPath);
    }).default("homeDir", this.homeDir).default("currentWorkDir", this.currentWorkDir).default("cliPath", this.cliPath).default("cliDistPath", this.cliDistPath).default("cliStoragePath", this.cliStoragePath).default("isRunningLocally", this.isRunningLocally).default("hostPlatform", this.hostPlatform).default("hostOS", this.hostOS);
  }
  async getPreCommandOptions() {
    let options = {};
    await this.nonStrict(async () => {
      options = await this.finalParse();
    });
    return options;
  }
  getPluginSources(options) {
    const configOptions = this.getConfigOptions(options);
    const sources = [
      ...this.normalizePluginOption(configOptions.plugin),
      ...this.normalizePluginOption(configOptions.plugins),
      ...this.normalizePluginOption(options.plugin),
      ...this.normalizePluginOption(options.plugins)
    ];
    return Array.from(new Set(sources));
  }
  getConfigOptions(options) {
    const explicitConfigPath = typeof options.config === "string" ? options.config : "";
    const configPath = explicitConfigPath || path.join(this.currentWorkDir, this.configFileName);
    return this.loadConfig(configPath);
  }
  normalizePluginOption(value) {
    if (typeof value === "string") {
      return value.trim() ? [value.trim()] : [];
    }
    if (Array.isArray(value)) {
      return value.filter((entry) => typeof entry === "string").map((entry) => entry.trim()).filter(Boolean);
    }
    return [];
  }
  registerCommand(args) {
    const { engine, engineVersion, _: command2 } = args;
    const commandCast = command2;
    this.command = new CommandFactory().selectEngine(engine, engineVersion).createCommand(commandCast);
  }
  async finalParse() {
    const { _, $0, ...options } = await this.yargs.parseAsync();
    if (log.isVeryVerbose)
      log.info("parsed:", _, $0, options);
    return options;
  }
  static handleFailure(message, error, yargs) {
    if (error)
      throw error;
    log.warning(message);
    process2.exit(1);
  }
  loadConfig(configPath) {
    try {
      const { readFileSync: readFileSync8 } = __require("node:fs");
      const configFile = readFileSync8(configPath, "utf-8");
      try {
        const jsonConfig = JSON.parse(configFile).cliOptions;
        if (log.isMaxVerbose)
          log.debug("jsonConfig", jsonConfig);
        return jsonConfig;
      } catch {
        const yamlConfigRaw = exports_dist.parse(configFile);
        const yamlConfig = yamlConfigRaw.cliOptions;
        if (log.isMaxVerbose)
          log.debug("yamlConfig", yamlConfig);
        return yamlConfig;
      }
    } catch (error) {
      if (error.code === "ENOENT") {
        return {};
      }
      throw new Error(`Could not parse config file ${configPath}`);
    }
  }
  async nonStrict(fn) {
    const previousStrict = this.yargs.getStrict();
    this.yargs.strict(false);
    await fn();
    this.yargs.strict(previousStrict);
  }
}

// src/index.ts
class GameCI {
  static async run() {
    try {
      const cli = new Cli(process.argv.slice(2), process.cwd());
      await cli.setup();
      await cli.registerCommands();
      await cli.registerSchemaForChosenCommand();
      const { command: command2, options } = await cli.validateAndParseArguments();
      const success = await command2.execute(options);
      GameCI.handleResult(success, command2);
    } catch (error) {
      GameCI.handleError(error);
    }
  }
  static handleResult(success, command2) {
    if (!log.isQuiet) {
      if (success) {
        log.info(`${command2.name} done.`);
      } else {
        log.warning(`${command2.constructor.name} failed.`);
      }
    }
    if (!success) {
      process.exit(1);
    }
  }
  static handleError(error) {
    try {
      log.error(error);
    } catch (metaError) {
      console.error("Error 1:", error);
      console.error("Error 2:", metaError);
    }
    process.exit(1);
  }
}
await GameCI.run();
