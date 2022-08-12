/* eslint-disable unicorn/prefer-export-from */
// These are the packages from Deno that replace the ones from Node.
import * as assert from 'https://deno.land/std@0.144.0/testing/asserts.ts';
import * as aws from 'https://deno.land/x/aws_api/client/mod.ts';
import * as base64 from 'https://deno.land/std@0.145.0/encoding/base64.ts';
import * as compress from 'https://deno.land/x/compress@v0.3.3/mod.ts';
import * as fs from 'https://deno.land/std@0.142.0/node/fs/promises.ts';
import * as fsSync from 'https://deno.land/std@0.142.0/fs/mod.ts';
import * as k8s from 'https://deno.land/x/kubernetes_client/mod.ts';
import * as k8sTypes from 'https://deno.land/x/kubernetes_apis/builtin/core@v1/mod.ts';
import * as nanoid from 'https://deno.land/x/nanoid@v3.0.0/mod.ts';
import * as path from 'https://deno.land/std@0.142.0/path/mod.ts';
import * as process from 'https://deno.land/std@0.104.0/node/process.ts';
import * as semver from 'https://deno.land/x/semver@v1.4.0/mod.ts';
import * as yaml from 'https://deno.land/std@0.145.0/encoding/yaml.ts';
import { crypto } from 'https://deno.land/std@0.142.0/crypto/mod.ts';
import { v4 as uuid } from 'https://deno.land/std@0.142.0/uuid/mod.ts';
import * as http from 'https://deno.land/std@0.145.0/node/http.ts';
import * as string from 'https://deno.land/std@0.36.0/strings/mod.ts';
import { Command } from 'https://deno.land/x/cmd@v1.2.0/commander/index.ts';
import { getUnityChangeset as getUnityChangeSet } from 'https://deno.land/x/unity_changeset@2.0.0/src/index.ts';

// Internally managed
import waitUntil from './modules/wait-until.ts';
import { core, exec } from './modules/actions/index.ts';

class Writable {
  constructor() {
    throw new Error('Writable is not implemented'); // stream
  }
}

const __filename = path.fromFileUrl(import.meta.url);
const __dirname = path.dirname(path.fromFileUrl(import.meta.url));

const { V1EnvVar, V1EnvVarSource, V1SecretKeySelector } = k8s;

export {
  __dirname,
  __filename,
  k8s,
  k8sTypes,
  V1EnvVar,
  V1EnvVarSource,
  V1SecretKeySelector,
  assert,
  aws,
  base64,
  Command,
  compress,
  core,
  crypto,
  exec,
  fs,
  fsSync,
  getUnityChangeSet,
  http,
  nanoid,
  path,
  process,
  semver,
  string,
  uuid,
  waitUntil,
  Writable,
  yaml,
};
