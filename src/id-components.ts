/*
 * Copyright 2017 Stephane M. Catala
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * Limitations under the License.
 */
;
import { isString } from './utils'
const parseURL = require('url').parse

export interface DocIdGeneratorFactory {
  (opts?: Partial<DocIdGeneratorSpec>): DocIdGenerator
}

export interface DocIdGeneratorSpec {
  parseURL: Function
}

export interface DocIdGenerator {
  (prefix?: string, url?: string, email?: string): string
}

interface Url {
  hostname: string
  pathname: string
}

// TODO URL-encode the resulting _id ?
const getDocIdGenerator: DocIdGeneratorFactory = function (opts?: Partial<DocIdGeneratorSpec>) {
  const parse = opts && opts.parseURL || parseURL
  return function getId (prefix?: string, url?: string, email?: string) {
    const dns = tokenizeURL(parse, url)
    const user = tokenizeEmail(parse, email)
    return [ prefix ].concat(user, dns).join('/')
  }
}

function tokenizeURL (parseURL: Function, url?: string): string[] {
	const { hostname, pathname }: Url = isString(url) && parseURL(url)
  const domains = isString(hostname) ? hostname.split('.').reverse() : []
  const paths = isString(pathname) ? pathname.split('/') : []
	return domains.slice(1).concat(domains[0], paths).filter(isNotEmpty)
}

function isNotEmpty (val?: string): boolean {
	return !!(val && val.length)
}

function tokenizeEmail (parseURL: Function, email?: string): string[] {
	if (!isString(email)) { return [] }
	const [ name, host ] = email.split('@')
  const dns = host ? tokenizeURL(parseURL, 'mailto:' + host) : []
  return dns.concat(name).filter(isNotEmpty)
}

export default getDocIdGenerator
