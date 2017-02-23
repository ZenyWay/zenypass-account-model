# zenypass-account-model [![Join the chat at https://gitter.im/ZenyWay/zenypass-account-model](https://badges.gitter.im/ZenyWay/zenypass-account-model.svg)](https://gitter.im/ZenyWay/zenypass-account-model?utm_source=badge&utm_medium=badge&utm_campaign=pr-badge&utm_content=badge)
[![NPM](https://nodei.co/npm/zenypass-account-model.png?compact=true)](https://nodei.co/npm/zenypass-account-model/)
[![build status](https://travis-ci.org/ZenyWay/zenypass-account-model.svg?branch=master)](https://travis-ci.org/ZenyWay/zenypass-account-model)
[![coverage status](https://coveralls.io/repos/github/ZenyWay/zenypass-account-model/badge.svg?branch=master)](https://coveralls.io/github/ZenyWay/zenypass-account-model)
[![Dependency Status](https://gemnasium.com/badges/github.com/ZenyWay/zenypass-account-model.svg)](https://gemnasium.com/github.com/ZenyWay/zenypass-account-model)

immutable model with access-control for ZenyPass records
of user bookmarks and corresponding identifiers.

## immutable
all entries of `Account` instances are read-only.
new instances with modified entries may be spawned
from any `Account` instance through its `Account.set` method.

## access-control
this module exposes a factory builder
which may be called by a 'controlling' party:
* factories that the controlling party instantiates with default settings
ignore `_id` and `_rev` entries from their input object.
in that case, the `_id` entry of instantiated `Account` objects
defaults to a string derived from the object's
`name`, `url` and `username` entries.
such factories may be publicly exposed.
* on the other hand, factories that the controlling party
instantiates with a `{ include_docref: true }` option
import `_id` and `_rev` entries - if defined -
into the instantiated `Account` objects.
such factories may be restricted to private use
by the controlling party.

additionally, when instantiating a factory,
the controlling party supplies `authorize` and `onEmit` methods:
* the `authorize` method may restrict access to the `password` function
when the `unrestricted` entry is `false`.
in that case, updates to the `_deleted` and `unrestricted` properties
are also restricted.
when access is restricted, the `authorize` method is called with a passphrase
supplied when calling the `Account.password` or `Account.set` methods.
the `authorize` method should return a `Promise` that resolves
to `true` when access is authorized,
`false` or alternatively reject with a corresponding Error otherwise.
* finally, the `onEmit` method provides indirect but unrestricted access
for the controlling party to private properties of an `Account` instance.
when calling `Account.emit`, the controlling party's `onEmit` method
is called with a plain object clone of the `Account` instance,
including its private entries, followed by any arguments
passed to `Account.emit`.
if the controlling party's `onEmit` method returns a value,
`Account.emit` returns that value as well.

note that the primary objective of this access-control scheme
is to expose an API that encapsulates logic for handling of restricted data.

## input sanitizing
`Account` factories only very basically sanitize inputs.
HTML-sanitizing is left to client code, if required.

# <a name="example"></a> example
```ts
import getAccountFactory, { AccountFactoryBuilder } from 'zenypass-account-model'
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
  debug('account-example:onEmit:')(doc)
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
```
the files of this example are available [in this repository](./spec/example).

view a [live version of this example in your browser console](https://cdn.rawgit.com/ZenyWay/zenypass-account-model/v1.2.0/spec/example/index.html),
or clone this repository and run the following commands from a terminal:
```bash
npm install
npm run example
```

# <a name="api"></a> API v1.0 stable
`ES5` and [`Typescript`](http://www.typescriptlang.org/) compatible.
coded in `Typescript 2`, transpiled to `ES5`.

for a detailed specification of the API,
[run the unit tests in your browser](https://cdn.rawgit.com/ZenyWay/zenypass-account-model/v1.2.0/spec/web/index.html).

# <a name="contributing"></a> CONTRIBUTING
see the [contribution guidelines](./CONTRIBUTING.md)

# <a name="license"></a> LICENSE
Copyright 2017 Stéphane M. Catala

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the [License](./LICENSE) for the specific language governing permissions and
Limitations under the License.
