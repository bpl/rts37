// Copyright © 2012 Aapo Laitinen <aapo.laitinen@iki.fi> unless otherwise noted
//
// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the "Software"), to deal
// in the Software without restriction, including without limitation the rights
// to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
// copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:
//
// The above copyright notice and this permission notice shall be included in
// all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
// OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
// SOFTWARE.

// Unit tests for the server module

var assert = require('assert');
var server = require('../src/server/server');

// Test the manager

var manager = new server.Manager();

manager.add({'id': 1, 'wakeAt': 0});
manager.add({'id': 2, 'wakeAt': 100});
manager.add({'id': 3, 'wakeAt': 0});
manager.add({'id': 4, 'wakeAt': 200});
manager.add({'id': 5, 'wakeAt': 300});
manager.add({'id': 6, 'wakeAt': 400});
manager.add({'id': 7, 'wakeAt': 0});
manager.add({'id': 8, 'wakeAt': 350});
manager.add({'id': 9, 'wakeAt': 500});
manager.add({'id': 10, 'wakeAt': 450});
manager.add({'id': 11, 'wakeAt': 375});
manager.add({'id': 12, 'wakeAt': 50});
manager.add({'id': 13, 'wakeAt': 250});

assert.strictEqual(manager.wakeQueue.length, 13);
assert.deepEqual(manager.tryDequeue(25), {'id': 7, 'wakeAt': 0});
assert.deepEqual(manager.tryDequeue(25), {'id': 3, 'wakeAt': 0});
assert.deepEqual(manager.tryDequeue(25), {'id': 1, 'wakeAt': 0});
assert.deepEqual(manager.tryDequeue(25), null);
assert.deepEqual(manager.tryDequeue(100), {'id': 12, 'wakeAt': 50});
assert.deepEqual(manager.tryDequeue(100), {'id': 2, 'wakeAt': 100});
assert.deepEqual(manager.tryDequeue(100), null);
assert.deepEqual(manager.tryDequeue(1000), {'id': 4, 'wakeAt': 200});
assert.deepEqual(manager.tryDequeue(1000), {'id': 13, 'wakeAt': 250});
assert.strictEqual(manager.wakeQueue.length, 13);
assert.deepEqual(manager.tryDequeue(1000), {'id': 5, 'wakeAt': 300});
assert.strictEqual(manager.wakeQueue.length, 5);
assert.deepEqual(manager.tryDequeue(1000), {'id': 8, 'wakeAt': 350});
assert.strictEqual(manager.wakeQueue.length, 5);
assert.deepEqual(manager.tryDequeue(1000), {'id': 11, 'wakeAt': 375});
assert.strictEqual(manager.wakeQueue.length, 5);
assert.deepEqual(manager.tryDequeue(1000), {'id': 6, 'wakeAt': 400});
assert.strictEqual(manager.wakeQueue.length, 5);

manager.add({'id': 14, 'wakeAt': 0});
manager.add({'id': 15, 'wakeAt': 200});
manager.add({'id': 16, 'wakeAt': 150});
manager.add({'id': 17, 'wakeAt': 450});

assert.strictEqual(manager.wakeQueue.length, 8);
assert.deepEqual(manager.tryDequeue(1000), {'id': 14, 'wakeAt': 0});
assert.deepEqual(manager.tryDequeue(1000), {'id': 16, 'wakeAt': 150});
assert.strictEqual(manager.wakeQueue.length, 8);
assert.deepEqual(manager.tryDequeue(1000), {'id': 15, 'wakeAt': 200});
assert.strictEqual(manager.wakeQueue.length, 3);
assert.deepEqual(manager.tryDequeue(1000), {'id': 10, 'wakeAt': 450});
assert.deepEqual(manager.tryDequeue(1000), {'id': 17, 'wakeAt': 450});
assert.strictEqual(manager.wakeQueue.length, 3);
assert.deepEqual(manager.tryDequeue(1000), {'id': 9, 'wakeAt': 500});
assert.deepEqual(manager.tryDequeue(1000), null);

assert.strictEqual(manager.wakeQueue.length, 0);