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
import getAccountFactory, { AccountFactoryBuilder, AccountDoc } from '../../src'
import getPbkdf2OSha512 from 'pbkdf2sha512'
import debug = require('debug')
debug.enable('account-example:*')

const pbkdf2 = getPbkdf2OSha512({ iterations: 8192 }) // min iterations

const SECRET_HASH = pbkdf2('secret passphrase')

function authorize (passphrase: string): Promise<boolean> {
  return SECRET_HASH.then(secret => pbkdf2(passphrase)
  .then(digest => digest.value === secret.value)) // optionally reject with Error when unauthorized
}

function onEmit (doc: AccountDoc): void {
  debug('account-example:accept:')(doc)
}

const accountFromDoc = getAccountFactory(authorize, onEmit, { include_docref: true })

const doc = accountFromDoc({
  _id: 'id',
  _rev: 'rev',
  url: 'https://example.com'
})
debug('account-example:from-doc:')(doc)

const accountFromObject = getAccountFactory(authorize, onEmit) // ignores DocRef entries

const empty = accountFromObject({ unrestricted: true }) // otherwise restricted by default
debug('account-example:from-object:unrestricted-empty:')(empty)

const bookmark = empty.set({ url: 'https://zenyway.com' }) // with default _id and name
.then(debug('account-example:from-object:unrestricted-bookmark:'))

const account = accountFromObject({ // restricted by default
  _id: 'id', // ignored, forced to default
  _rev: 'rev', // ignored, forced to undefined
  url: 'https://secure.example.com',
  username: 'j.doe@example.com',
  password: 'secret password'
})

account
debug('account-example:from-object:restricted-account:')(account)

account.password('secret passphrase') // passphrase required
.then(debug('account-example:from-object:restricted-account:password:'))

const unrestricted = account
.set({ unrestricted: true }, 'secret passphrase') // passphrase required

unrestricted
.then(debug('account-example:from-object:unrestricted-account:'))

unrestricted
.then(unrestricted => unrestricted.password()) // no passphrase required
.then(debug('account-example:from-object:unrestricted-account:password:'))

unrestricted
.then(unrestricted => unrestricted.emit<void>()) // emit private account object to onEmit listener