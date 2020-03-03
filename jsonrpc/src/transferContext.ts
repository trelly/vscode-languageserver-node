/* --------------------------------------------------------------------------------------------
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */
'use strict';

import { Message, isRequestMessage } from './messages';

export class TransferContext {

	private static ACCEPT_ENCODING = 'Accept-Encoding';

	private state: Map<string | number, Map<string, string>>;
	private defaultRequestEncodings: string[];

	constructor() {
		this.state = new Map();
		this.defaultRequestEncodings = [];
	}

	public setDefaultRequestEncodings(value: string): void {
		this.defaultRequestEncodings = [value];
	}

	public capture(msg: Message, headers: Map<string, string>): void {
		if (!isRequestMessage(msg)) {
			return;
		}

		this.state.set(msg.id, headers);
	}

	public getNotificationContentEncoding(_supportedEncoding: { has(value: string): boolean; }): string | undefined {
		return undefined;
	}

	public getRequestContentEncoding(supportedEncoding: { has(value: string): boolean; }): string | undefined {
		if (this.defaultRequestEncodings.length === 0) {
			return undefined;
		}
		for (const encoding of this.defaultRequestEncodings) {
			if (supportedEncoding.has(encoding)) {
				return encoding;
			}
		}
		return undefined;
	}

	public getResponseAcceptEncodings(_supportedEncoding: { has(value: string): boolean; }): string[] | undefined {
		return undefined;
	}

	public getResponseContentEncoding(id: string | number | null, supportedEncodings: { has(value: string): boolean; }): string | undefined {
		if (id === null) {
			return undefined;
		}
		const headers = this.state.get(id);
		if (headers === undefined) {
			return undefined;
		}

		const acceptEncodings = headers.get(TransferContext.ACCEPT_ENCODING);
		if (acceptEncodings === undefined) {
			return undefined;
		}
		// Accept-Encoding: deflate, gzip;q=1.0, *;q=0.5
		const encodings = acceptEncodings.split(/\s*,\s*/);
		let defaultQuality: number = 1;
		for (const value of encodings) {
			if (value.startsWith('*;q=')) {
				const parsed = parseFloat(value.substr(4));
				if (parsed !== NaN) {
					defaultQuality = parsed;
				}
			}
		}
		const result: { encoding: string | undefined; quality: number } = { encoding: undefined, quality: -1 };
		for (const value of encodings) {
			const index = value.indexOf(';q=');
			let q: number = defaultQuality;
			let encoding: string;
			if (index !== -1) {
				const parsed = parseFloat(value.substr(index));
				if (parsed !== NaN) {
					q = parsed;
				}
				encoding = value.substr(0, index);
			} else {
				encoding = value;
			}
			if (encoding !== '*' && supportedEncodings.has(encoding) && q > result.quality) {
				result.encoding = encoding;
				result.quality = q;
			}
		}
		return result.encoding;
	}
}