// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import * as fs from 'fs';
import * as path from 'path';

import type { UserConfig as WebhintUserConfig } from '@hint/utils';
import { hasFile } from './utils/fs';

export async function getWebhintUserConfig(path: string): Promise<WebhintUserConfig> {
    if (!(await hasFile(path))) {
        // .hintrc does not exists so create one with the default config
        const defaultConfig = { extends: ['development'] };
        await fs.promises.writeFile(path, JSON.stringify(defaultConfig), 'utf-8');
    }

    // user config file is guaranteed to exist at this point, now read it.
    const rawUserConfig = await fs.promises.readFile(path, 'utf-8');
    const userConfig = JSON.parse(rawUserConfig) as WebhintUserConfig;
    return userConfig;
}

export function getWehbhintConfigPath(directory: string): string {
    return path.join(directory, '.hintrc');
}

export async function ignoreProblemInHints(problemName: string, hintName: string, configFilePath: string): Promise<void> {
    const userConfig = await getWebhintUserConfig(configFilePath);

    await addProblemToIgnoredHintsConfig(configFilePath, userConfig, hintName, problemName);
}

export async function addProblemToIgnoredHintsConfig(configFilePath: string, userConfig: WebhintUserConfig, hintName: string, problemName: string): Promise<void> {
    if (!userConfig.hints) {
        userConfig.hints = {};
    }

    // TODO: support array syntax
    if (Array.isArray(userConfig.hints)) {
        throw new Error('Cannot alter hints collection written as an array');
    }

    const hint = userConfig.hints[hintName];
    const ignore = {'ignore': [problemName]};
    const defaultObject = ['default', ignore];

    if (hint) {
        // hint value is a configuration array e.g "hints": { "compat-api/css": [] }
        if (Array.isArray(hint)){
            // search for the 'ignore' key inside each item, start from position [1] (zero-index based)
            // as position [0] should always be a severity.
            for (let i = 1; i < hint.length; i++) {
                const ignoreProperty = hint[i].ignore;

                if (ignoreProperty && typeof ignoreProperty.value === typeof []) {

                    // a list of ignored properties was found, use that one.
                    ignore.ignore = ignoreProperty.value as [];
                    defaultObject[0] = hint[i - 1];
                    ignore.ignore.push(problemName);
                    break;
                }
            }
        } else if (typeof hint === 'string'){
            defaultObject[0] = hint;
        }
    }

    Object.defineProperty(userConfig.hints, hintName, {
        enumerable: true,
        value: defaultObject,
        writable: true,
    });

    await fs.promises.writeFile(configFilePath, JSON.stringify(userConfig), 'utf-8');
}

async function ignoreHint(hintName: string | undefined, configFilePath: string) {
    const userConfig = await getWebhintUserConfig(configFilePath);
    if (!userConfig || !hintName) {
        return;
    }

    if (!userConfig.hints) {
        userConfig.hints = {};
    }

    userConfig.hints = Object.defineProperty(userConfig.hints, hintName, {
        value: 'off',
        writable: true,
        enumerable: true,
    });

    // save new config
    const serializedConfig = JSON.stringify(userConfig);
    return fs.promises.writeFile(configFilePath, serializedConfig, 'utf-8');
}

export async function ignoreHintPerProject(hintName: string, workspace: string): Promise<void> {
    const configFilePath = getWehbhintConfigPath(workspace);
    return ignoreHint(hintName, configFilePath);
}

export async function ignoreHintGlobally(hintName: string, globalStoragePath: string): Promise<void> {
    const configFilePath = getWehbhintConfigPath(globalStoragePath);
    await ignoreHint(hintName, configFilePath);
}
