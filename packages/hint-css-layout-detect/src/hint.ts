/**
 * @fileoverview Detect which css properties changes will trigger the layout rendering pipeline
 */

import { HintContext } from 'hint/dist/src/lib/hint-context';
// The list of types depends on the events you want to capture.
import { IHint, ElementFound } from 'hint/dist/src/lib/types';
import { debug as d } from '@hint/utils-debug';
import { Severity } from '@hint/utils-types';

import meta from './meta';

import { getMessage } from './i18n.import';

const debug: debug.IDebugger = d(__filename);

/*
 * ------------------------------------------------------------------------------
 * Public
 * ------------------------------------------------------------------------------
 */

export default class CssLayoutDetectHint implements IHint {

    public static readonly meta = meta;

    public constructor(context: HintContext) {

        // Your code here.
        const validateElement = async (elementFound: ElementFound) => {
            // Code to validate the hint on the event when an element is visited.

            const { resource } = elementFound;
            
            debug(`Validating hint css-layout-detect`);
            
            /*
             * This is where all the magic happens. Any errors found should be
             * reported using the `context` object. E.g.:
             * context.report(resource, 'Add error message here.');
             *
             * More information on how to develop a hint is available in:
             * https://webhint.io/docs/contributor-guide/how-to/hint/
             */
            
            if (Math.ceil(Math.random()) === 0) {
                context.report(resource, getMessage('reportMessage', context.language), { severity: Severity.default });
            }
        };

        context.on('element::div', validateElement);
        // As many events as you need
    }
}
