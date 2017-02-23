/*
 * Copyright 2016 Stephane M. Catala
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
import { isString, isBoolean, isFunction } from './utils'
import getDocIdGenerator from './id-components'
import { __assign as assign } from 'tslib'
const parseURL = require('url').parse

export interface AccountFactoryBuilder {
  (authorize: Authorize,
  onEmit: <T>(doc: Partial<AccountDoc>, account?: Account) => T,
  opts?: Partial<AccountFactorySpec>): AccountFactory
}

/**
 * should return `true` if passphrase is authorized.
 * otherwise, should either return false,
 * or reject with a corresponding error.
 */
export interface Authorize {
  (passphrase: string): Promise<boolean>
}

export interface AccountFactorySpec {
  /**
   * when `false`, generate a default `name` entry
   * from `AccountDoc.url` for a given `AccountDoc`
   * if missing.
   * otherwise, default to empty string.
   *
   * default: false
   */
  no_default_name: boolean
  /**
   * when `true`, process all entries from `AccountDoc` instances,
   * including `DocRef` entries.
   * otherwise, restrict the factory to `AccountObject` instances.
   *
   * default: false
   */
  include_docref: boolean
  getId (account?: Partial<AccountObject>): string,
  getDefaultName (account?: Partial<AccountObject>): string
}

/**
 * create an `Account` instance from a `Partial<AccountDoc>` object.
 * * the `_id` entry is ignored if this `AccountFactory` was
 * instantiated without `AccountFactorySpec.include_docref` option.
 * * the `_rev` property of the returned `Account` instance
 * is forced to `undefined`.
 * * unless `AccountSpec.no_default_name` is `true`,
 * when called with an `AccountDoc` with a falsy `name` entry,
 * returns a new `Account` instance with a default `name` value.
 * it is possible to override this default
 * with `Account.set` on the returned instance.
 */
export interface AccountFactory {
  (account?: Partial<AccountDoc>): Account
}

export interface AccountObject { // no _id or _rev properties
  name: string
  url: string
  username: string
  password: string
  keywords: string[]
  comments: string
  /**
   * automatic login
   * default: false
   */
  login: boolean
  /**
   * disables passphrase-protected access to the `password` property.
   * default: `false`
   */
  unrestricted: boolean
  _deleted?: boolean
}

export interface Account extends DocRef {
  readonly _deleted?: boolean
  readonly name: string
  readonly url: string
  readonly username: string
  readonly keywords: string[]
  readonly comments?: string
  readonly login: boolean
  readonly unrestricted: boolean
  /**
   * return the password string.
   *
   * @error {Error} 'invalid passphrase'
   * when `restricted` is `true` and `passphrase` is invalid.
   */
  password (passphrase?: string): Promise<string>
  /**
   * create a new `Account` instance from this `Account`
   * with updated entries from the given `props`
   * `Partial<AccountDoc>` object.
   *
   * `props._id` and `props._rev` are ignored
   * if this `Account` originates from an instance generated
   * without `AccountFactorySpec.include_docref` option.
   *
   * updating the `url` and/or `username` entries
   * yields a corresponding new `Account._id` value
   * and deletes `Account._rev`.
   *
   * @error {Error} 'invalid passphrase'
   * when the `passphrase` is invalid
   * and when `unrestricted` is `false`
   * and `props` includes either a `password`
   * or a `_deleted: true` or an `unrestricted: true` entry.
   */
  set (props: Partial<AccountObject>, passphrase?: string): Promise<Account>
  emit <T>(): T
}

export interface AccountDoc extends AccountObject, DocRef {}

export interface DocRef {
  readonly _id: string
  readonly _rev?: string
}

const ACCOUNT_OBJECT_DEFAULTS: AccountObject = {
  name: '',
  url: '',
  username: '',
  password: '',
  keywords: [],
  comments: '',
  login: false,
  unrestricted: false
}

const IS_VALID_ACCOUNT_OBJECT_ENTRY: { [P in keyof AccountObject]: Predicate } = {
  name: isString,
  url: isString,
  username: isString,
  password: isString,
  keywords: isStrings, // string[]
  comments: isString,
  login: isBoolean,
  unrestricted: isBoolean,
  _deleted: isBoolean
}

const getAccountFactory: AccountFactoryBuilder =
function (authorize: Authorize,
onEmit: <T>(doc: Partial<AccountDoc>, account?: Account) => T,
opts?: Partial<AccountFactorySpec>) {
  return function (obj?: any) {
    return _AccountBuilder.getInstance(authorize, onEmit, opts)
    .withProperties(obj)
    .withBasicDefaults().withDefaultNameAndId()
    .withDocRef(obj)
    .toAccount()
  }
}

class _AccountBuilder {
  static getInstance (authorize: Authorize,
  onEmit: <T>(doc: Partial<AccountDoc>, account?: Account) => T,
  opts?: Partial<AccountFactorySpec>): _AccountBuilder {
    const withDocRef = opts && opts.include_docref
    const authHandler = isFunction(authorize) ? authorize : freepass
    const emitHandler = isFunction(onEmit) ? onEmit : noop
    const getDocId = opts && opts.getId || toDocId
    const getName = opts && opts.no_default_name ? noop : getDefaultName

    return new _AccountBuilder(withDocRef, authHandler, emitHandler, getDocId, getName)
  }

  withProperties (val?: any): _AccountBuilder {
    const props = sanitizeAccountObject(val)
    return !Object.getOwnPropertyNames(props).length
    ? this
    : this.getInstance(assign({}, this.account, props))
    .withDefaultNameAndId()
  }

  withDocRef (val?: any): _AccountBuilder {
    const docref = this.includeDocRef && toDocRef(val)
    return !docref || !docref._id
    ? this
    : this.getInstance(assign({}, this.account, docref))
  }

  withBasicDefaults (): _AccountBuilder {
    const account = Object.getOwnPropertyNames(ACCOUNT_OBJECT_DEFAULTS)
    .reduce((account, key) => {
      account[key] = key in this.account
      ? this.account[key]
      : ACCOUNT_OBJECT_DEFAULTS[key]
      return account
    }, <AccountObject>{})
    return this.getInstance(account)
  }

  withDefaultNameAndId (): _AccountBuilder {
    return this.withDefaultName().withDefaultId()
  }

  /**
   * @return {boolean} `true` when `account.unrestricted` is `true`,
   * or `props` includes neither a `password` string,
   * nor a `_deleted: true`, nor an `unrestricted: true` entry.
   */
  isUnrestrictedUpdate (builder: _AccountBuilder): boolean {
    const update = builder.account
    return  this.account.unrestricted
    || !update._deleted && !update.unrestricted && !isString(update.password)
  }

  toAccount (): Account {
    const builder = this
    const account = this.account
    const onEmit = builder.onEmit // unbind from builder to prevent leak
    return {
      get _id () { return account._id },
      get _deleted () { return account._deleted },
      get name () { return account.name },
      get url () { return account.url },
      get username () { return account.username },
      get keywords () { return account.keywords.slice() }, // defensive copy
      get comments () { return account.comments },
      get login () { return account.login },
      get unrestricted () { return account.unrestricted },
      password (passphrase?: string) {
        return builder.assertPassphrase(account.unrestricted, passphrase)
        .then(ok => account.password)
      },
      set (val?: any, passphrase?: string) {
        const update = builder.withProperties(val)
        return builder === update
        ? Promise.resolve(this)
        : builder
        .assertPassphrase(builder.isUnrestrictedUpdate(update), passphrase)
        .then(ok => !ok
        ? this // authorize may optionally reject with an Error, in which case this never executes
        : update.withDefaultNameAndId().toAccount())
      },
      emit <T>() {
        return onEmit<T>(account, this)
      }
    }
  }

  private constructor (
    readonly includeDocRef: boolean,
    readonly authorize: Authorize,
    readonly onEmit: <T>(doc: Partial<AccountDoc>, account?: Account) => T,
    readonly getDocId: (obj: Partial<AccountObject>) => string,
    readonly getName: (obj: Partial<AccountObject>) => string|void,
    readonly account: Partial<AccountDoc> = {}
  ) {}

  private getInstance (account: Partial<AccountDoc>): _AccountBuilder {
    return new _AccountBuilder(this.includeDocRef, this.authorize,
    this.onEmit, this.getDocId, this.getName, account)
  }

  private withDefaultName (): _AccountBuilder {
    const name = this.account.name || this.getName(this.account)
    return !name || (name === this.account.name)
    ? this
    : this.getInstance(assign(this.account, { name: name }))
  }

  private withDefaultId (): _AccountBuilder {
    const _id = this.getDocId(this.account)
    return _id === this.account._id
    ? this
    : this.getInstance(deleteDocRev(assign({}, this.account, { _id: _id })))
  }

  /**
   * @return {Promise<true>} when unrestricted
   * or authorize(passphrase) resolves to `true`
   *
   * @error {Error} 'invalid passphrase'
   */
  private assertPassphrase (unrestricted: boolean, passphrase?: string): Promise<true> {
    return Promise.resolve(unrestricted || this.authorize(passphrase))
    .then(ok => ok || Promise.reject(new Error('invalid passphrase')))
  }
}

const TRUE = Promise.resolve(true)
function freepass (): Promise<boolean> {
  return TRUE
}

function getDefaultName (account: Partial<AccountObject>): string {
  if (!account.url || !account.url.length) { return '' }
  const { host } = parseURL(account.url)
  if (!isString(host) || !host.length) { return '' }
  const dns = host.split('.')
  const index = dns.length - 2 // index of topmost subdomain
  return index < 0 ? '' : dns[index]
}

const getDocId = getDocIdGenerator()
function toDocId (account: Partial<AccountObject>) {
  return getDocId(account.name, account.url, account.username)
}

function toDocRef (val?: any): Partial<DocRef> {
  const _id = val && isString(val._id) && val._id
  if (!_id) { return {} }
  const _rev = isString(val._rev) && val._rev
  return _rev ? { _id: _id, _rev: _rev} : { _id: _id }
}

/**
 * mutates input doc!
 * delete `doc._rev` entry and return `doc`
 */
function deleteDocRev <T extends DocRef>(doc: T): T {
  delete doc._rev
  return doc
}

function noop (): void {}

interface Predicate {
  (val: any): boolean
}

/**
 * spawn a new object with all valid `AccountObject` entries
 * from the given object. array entries are shallow copied.
 */
function sanitizeAccountObject (obj?: any): Partial<AccountObject> {
  return !obj
  ? {}
  : Object.getOwnPropertyNames(IS_VALID_ACCOUNT_OBJECT_ENTRY)
  .filter(key => key in obj)
  .reduce((account, key) => {
    if (IS_VALID_ACCOUNT_OBJECT_ENTRY[key](obj[key])) {
      const val = obj[key]
      account[key] = Array.isArray(val) ? val.slice() : val // shallow copy arrays
    }
    return account
  }, <AccountObject>{})
}

/**
 * @return {boolean} `true` when val is an Array of strings
 * or an empty Array
 */
function isStrings (val: any): val is string[] {
  return Array.isArray(val) && val.every(isString)
}

export default getAccountFactory