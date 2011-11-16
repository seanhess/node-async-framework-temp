
if (module == require.main) {
    var cp = require('child_process')
    require("async_testing").run([__filename], function() {})
}

// Helper methods
function delay(cb) {
    setTimeout(cb, Math.random() * 100) // to make sure we don't have race conditions
}


function makeFakeDb(content) {
    var fakeDb = content
    return {
        fetch: function(name, cb) {
            delay(function() {
                cb(null, fakeDb[name])
            })
        },

        save: function (name, item, cb) {
            delay(function() {
                fakeDb[name] = item
                cb()
            })
        }
    }
}

function makeWriter() {
    function write(letter, cb) {
        write.message += letter // will show that it started
        setTimeout(function() {
            write.message += letter
            cb()
        }, Math.random() * 100)
    }

    write.message = ""

    return write
}

var cs = require("coffee-script")
var as = require("./index.js")

exports.simpleSteps = function(assert) {

    var num = 0
    function one(cb) {
        num += 1
        cb()
    }

    var actions = as(one, function(one) {
        one() // each of these needs to CREATE a promise? or return one, just create one
        one()
        one()
        return "Hi"
    })

    actions(function(err, message) {
        assert.ifError(err)
        assert.equal(num, 3)
        assert.equal(message, "Hi")
        assert.finish()
    })
}

exports.asyncSteps = function(assert) {

    var message = ""
    function write(letter, cb) {
        setTimeout(function() {
            message += letter
            cb()
        }, Math.random() * 100)
    }

    var actions = as(write, function(write) {
        write("a") 
        write("b")
        write("c")
    })

    actions(function() {
        assert.equal(message, "abc")
        assert.finish()
    })
}

exports.parallelSteps = function(assert) {

    var write = makeWriter()

    var actions = as(write, function(write) {
        // parallel use cases:
        // 1. I have to call 2 different things, 
        write("a").p()
        write("b").p()
        write("c").p()
        // write("d")
    })

    actions(function() {
        assert.equal(write.message.substr(0,3), "abc")
        assert.finish()
    })

}

exports.parallelThenSequence = function(assert) {

    var write = makeWriter()

    var actions = as(write, function(write) {
        // parallel use cases:
        // 1. I have to call 2 different things, 
        write("a").p()
        write("b").p()
        write("c").p()
        write("d")
    })

    actions(function() {
        assert.equal(write.message.substr(0,3), "abc")
        assert.equal(write.message.substr(-2,2), "dd")
        assert.finish()
    })
}

exports.simpleValue = function(assert) {

    function getValue(cb) {
        cb(null, 3)
    }

    var actions = as(getValue, function(getValue) {
        return getValue()
    })

    actions(function(err, val) {
        assert.ifError(err)
        assert.equal(val, 3)
        assert.finish()
    })
}



exports.immediateValues = function(assert) {

    var num = 0
    function one(cb) {
        num += 1
        cb(null, num)
    }

    // so, unfortunately, pure functions get called with an extra callback :(
    function sum() {
        return Array.prototype.reduce.call(arguments, function(sum, n) {
            if (n+0 == n) 
                return sum+n
            else return sum
        })
    }

    assert.equal(sum(1,2,3), 6)

    var actions = as(one, sum, function(one, sum) {
        var val1 = one() // each of these needs to CREATE a promise? or return one, just create one
        var val2 = one()
        var val3 = one()
        var result = sum(val1, val2, val3) // you can't do v1 + v2 + v3, because that is executed immediately
        return result 
    })

    actions(function(err, val) {
        assert.ifError(err)
        assert.equal(val, 6)
        assert.finish()
    })
}

exports.passingValues = function(assert) {

    // pretend this is something async
    function add1(num, cb) {
        process.nextTick(function() {
            cb(null, num+1)
        })
    }

    var actions = as(add1, function(add1) {
        var one = add1(0)
        var two = add1(one)

        var current = two

        // use case: I want to get a bunch of stuff async and get it into an array
        for (var i = 0; i < 3; i ++)
            current = add1(two).p()

        return add1(add1(current))
    })

    actions(function(err, val) {
        assert.ifError(err)
        assert.equal(val, 5)
        assert.finish()
    })
}

// right now, you couldn't do that, but you could do: renderScores(req, scores, blah, blah)
exports.nestedObjects = function(assert) {

    var Scores = {
        getScores: function(cb) {
            cb(null, [1,2,3])
        }
    }

    var actions = as(Scores.getScores, function(getScores) {
        var scores = getScores()
        return {
            name: "example",
            scores: scores
        }
    })

    actions(function(err, val) {
        assert.ok(val)
        assert.deepEqual(val.scores, [1,2,3])
        assert.finish()
    })
}


exports.accessSubPropertyOfPromise = function(assert) {

    // pretend this is something async
    function getData(cb) {
        process.nextTick(function() {
            cb(null, {person:{name:"bob"}})
        })
    }

    var actions = as(getData, function(getData) {
        var result = getData()
        return result.person.name
    })

    actions(function(err, val) {
        assert.ifError(err)
        assert.deepEqual(val, "bob")
        assert.finish()
        assert.finish = function() {
            throw new Error("called finish twice")
        }
    })

}


exports.accessSubFunctionOfPromise = function(assert) {

    function getData(cb) {
        process.nextTick(function() {
            cb(null, {
                key: "value",
                getPerson: function(name) { return {name: name} }
            })
        })
    }

    var actions = as(getData, function(getData) {
        var result = getData()
        return result.getPerson('bob').name
    })

    actions(function(err, val) {
        assert.ifError(err)
        assert.deepEqual(val, "bob")
        // assert.ok(false, "Need to try an asynchronous function") // don't currently support asynchronous functions
        assert.finish()
    })
}

exports.nullTolerantGets = function(assert) {
    function getData(cb) {
        process.nextTick(function() {
            cb(null, {})
        })
    }

    var actions = as(getData, function(getData) {
        var result = getData()
        var nameValue = result.name
        // console.log("OK", nameValue, nameValue.source().value)
        var notRealValue = result.name.henry
        // console.log("CHECK", notRealValue, notRealValue.source().value)
        return notRealValue
    })

    actions(function(err, val) {
        assert.ifError(err)
        assert.ok(!val, "Val should have been undefined or null or something")
        assert.finish()
    })
}


exports.readFromDbSetPropThenSaveThenRead = function(assert) {
    // means you have to figure out how to get it to "set" on a promise
    // not hard, just make a fake function that sets on the param, run it like normal

    var db = makeFakeDb({bob:{name:"bob"}})

    var actions = as(db.fetch, db.save, function(fetch, save) {
        var bob = fetch("bob")
        bob.name = "not bob"
        save("bob", bob)
        bob = fetch("bob")
        return bob
    })

    actions(function(err, val) {
        assert.ifError(err)
        assert.deepEqual(val, {name:"not bob"})
        assert.finish()
    })
}


exports.errors = function(assert) {

    function giveError(cb) {
        process.nextTick(function() {
            cb(new Error("OH NO"), "result")
        })
    }

    var actions = as(giveError, function(giveError) {
        var obj = giveError()
        obj.something = "hi" // this also tests that you can set on a null value
        return obj
    })

    actions(function(err, val) {
        assert.ok(err)
        assert.ok(!val)
        assert.finish()
    })
}


exports.setSomethingToAPromise = function(assert) {
    var db = makeFakeDb({
        bob:{name:"bob"},
        jill:{name:"jill"}
    })

    var actions = as(db.fetch, db.save, function(fetch, save) {
        var bob = fetch("bob")
        var jill = fetch("jill")
        bob.name = jill.name
        save("bob", bob)
        return fetch("bob")
    })

    actions(function(err, val) {
        assert.ifError(err)
        assert.deepEqual(val, {name:"jill"})
        assert.finish()
    })
}

exports.convertEntireModules = function(assert) {
    var db = makeFakeDb({bob:{name:"bob"}})

    var actions = as(db, function(db) {
        return db.fetch("bob")
    })

    actions(function(err, val) {
        assert.ifError(err)
        assert.deepEqual(val, {name:"bob"})
        assert.finish()
    })
}

exports.convertModulesOutside = function(assert) {
    var db = makeFakeDb({bob:{name:"bob"}})
    dba = as.convert(db)

    var actions = as(function() {
        return dba.fetch("bob")
    })

    var sameTime = as(function() {
        dba.save("henry", {name:"henry"})
        return dba.fetch("henry")
    })

    actions(function(err, val) {
        assert.ifError(err)
        assert.deepEqual(val, {name:"bob"})

        process.nextTick(function() {
            assert.finish()
        })
    })

    // for kicks, make sure the global promise queue is working without overwriting the other one
    sameTime(function(err, val) {
        assert.deepEqual(val, {name:"henry"})
    })
}

// Should be able to pass parameters into action blocks
// they are kind of useless otherwise :)
exports.parametersToAsBlocks = function(assert) {

    function echo(value, cb) {
        process.nextTick(function() {
            cb(null, value)
        })
    }

    // crimeny! I don't even support arguments? That's a little useless!
    // it gets called right away, no... yeah, when it's created
    // it creates a bunch of promises
    var actions = as(echo, function(echo, value) {
        var result = echo(value)
        return result
    })

    actions(10, function(err, val) {
        assert.ifError(err)
        assert.deepEqual(val, 10)
        assert.finish()
    })
}


exports.callActionsTwice = function(assert) {

    function getData(name, cb) {
        process.nextTick(function() {
            cb(null, {name:name})
        })
    }

    getDataAs = as.convert(getData)



    // crimeny! I don't even support arguments? That's a little useless!
    // it gets called right away, no... yeah, when it's created
    // it creates a bunch of promises
    var actions = as(function(name) {
        var result = getDataAs(name)
        return result
    })

    actions("bob", function(err, val) {
        assert.ifError(err)
        assert.deepEqual(val, {name:"bob"})

        actions("henry", function(err, val) {
            assert.ifError(err) 
            assert.deepEqual(val, {name:"henry"})
            assert.finish()
        })
    })
}



// should be able to call other asyncified versions without un-escaping them
exports.nestedPromiseBlocks = function(assert) {

    var valueToReturn = 0
    function getValue(cb) {
        process.nextTick(function() {
            cb(null, valueToReturn)
        })
    }

    function setValue(val, cb) {
        process.nextTick(function() {
            valueToReturn = val
            cb()
        })
    }

    var setValueAndStuff = as(setValue, getValue, function(setValue, getValue, value) {
        setValue(value)
        return getValue()
    })

    var getSeveralValues = as(getValue, function(getValue) {
        var values = {}
        values.one = getValue()
        values.two = getValue()
        return values
    })

    var actions = as(getSeveralValues, function(getSeveralValues) {
        var result = setValueAndStuff(20) // there's no way. not if setValueSeveralTimes is already a normal function
        var values = getSeveralValues()
        return values
    })

    actions(20, function(err, value) {
        assert.ifError(err)
        assert.deepEqual(value, {one: 20, two: 20})
        assert.finish()
    })

    
}


exports.getExtraDataForEachItem = function(assert) {

    function getDocs(cb) {
        process.nextTick(function() {
            cb(null, [{id:1},{id:2}])
        })
    }

    function getTagsForDoc(doc, cb) {
        process.nextTick(function() {
            cb(null, ["a","b","c"])
        })
    }

    function asyncForEach(vs, f, cb) {
        // run them all in sequence
        vs = vs.concat()
        function next() {
            var v = vs.shift()
            if (!v) {
                return cb()
            }
            f(v, next) // this has to be async as well, no? 
        }
        next()
    }

    // function setTagsForDoc(doc, cb) {
    //     getTagsForDoc(doc, function(err, tags) {
    //         if (err) return cb(err)
    //         doc.tags = tags
    //         cb()
    //     })
    // }

    // got to get this working first
    var setTagsForDoc = as(getTagsForDoc, function(getTagsForDoc, doc) {
        var tags = getTagsForDoc(doc)

        // now doc is a promise, so it'll register this set
        doc.tags = tags
    })

    var doc = {}
    setTagsForDoc(doc, function(err, value) {
        assert.ifError(err)
        assert.deepEqual(doc, {tags:["a","b","c"]})
        assert.finish()
    })

    return

    var actions = as(getDocs, getTagsForDoc, asyncForEach, function(getDocs, getTagsForDoc, asyncForEach) {
        var docs = getDocs()

        // var ids = docs.map(function(doc) {
        //     console.log("MAPPING", doc)
        //     return doc.id
        // })

        // var docsWithTags = docs.forEach(function(doc) {
        //     console.log("UMMM", getTagsForDoc(doc))
        //     doc.tags = getTagsForDoc(doc)
        // })

        asyncForEach(docs, setTagsForDoc)

        // If I could create a magic promise as a result of a call to forEach
        // that represents the fact that I'll make/insert more
        // Magic promises have their own promises
        // when run, they generate a bunch of promises, then run those
        // Yay!
        // Ok, if I can get it so that promises generate when it hits a certain step, then it runs all of them
        // "Run all of them" is the same as just calling an async function, isn't it?
        // So I don't have to interface in a fancy way, I just have to create a function call that has an async
        // signature, and runs its own promises instead

        // So, if they ask for forEach, just return async forEach
        // If they ask for map, just use that, etc?
        // What about parallel? 

        // docs.forEach(function(doc) {
        //     console.log("INSIDE FOR EACH", doc)
        //     doc.tags = getTagsForDoc(doc)
        // })

        // when this fires, return a promise to call forEach async version, but convert mapping function as well

        // 1 // I could implement forEach and map by hand
            // a function that takes a promise doc
            // and um,, I don't know :)
            // kind of hard. 
            // is it parallel or sequence? Either way, it shouldn't move to the next loop unless the loop registers as done?
            // No, it should create a bunch of promises, for the whole loop
            // either way, its' going to be hard. Have to create a second thing

            // so, I need a way to create a bunch of sub-promises
            // well, if I could create an async function, like: 
            // yeah, try to implement by hand first

        // 2 // Right before calling, I could create a new queue, etc
            // I am creating promises already for getTagsForDoc
            // doc is resolved
            // so doc.tags is currently set to a promise
            // I just need to run them all
            // it's bad that doc is resolved, because it sets immediately
            // So, I'd need to have doc be the promise for doc, not the resolved version
            // might be easier to implement by hand, try that first

        return docs
    })

    actions(function(err, val) {
        assert.ifError(err)
        assert.deepEqual(val[0], {id:1, tags:["a","b","c"]})
        assert.finish()
    })

}

// exports.conditionalEscaping = function(assert) {
//     assert.ok(false, "If you get nothing back from a db, return early")
//     assert.finish()
// }
// 
// exports.conditionalDefaults = function(assert) {
//     assert.ok(false, "If you get nothing back from a db, use a default value instead")
//     assert.finish()
// }
// 
// exports.lists = function(assert) {
//     assert.ok(false, "Take a list of ids and turn them into a list of objects in the same order")
//     assert.finish()
// }
// 
// exports.asyncMap = function(assert) {
//     assert.ok(false, "Make it so you can map an array of somethings async style")
//     assert.finish()
// }
// 
// exports.asyncForEach = function(assert) {
//     assert.ok(false, "Make it so you can async loop through something and modify each item")
//     assert.finish()
// }

// exports.oneBigPromise = function(assert) {
//     assert.ok(false, "while the result of as is a function, it should also be a promise you could include in another one, or print out ")
//     assert.finish()
// }

// Scores.getScores(function(err, defaults, scores) {
//     if (err) return res.send(err)
// 
//     res.render("weights", {
//         sources: defaults.sources.toObject(),
//         types: scores
//     })    
// })

// Entity.statics.findByProgram = function(programId, cb) {
//     var Entity = this
//     var AugmentedProgram = mongoose.model("AugmentedProgram")
// 
//     AugmentedProgram.findByProgram(programId, function(err, augmentedPrograms) {
//         if (!augmentedPrograms.length) return cb(null, {})
//         var entities = {}
//         var processed = 0
// 
//         var step = new Step(cb)
// 
//         augmentedPrograms.forEach(function(augmentedProgram) {
//             step("augment", function(done, entities) {
//                 if (!entities) entities = {}
// 
//                 Entity.findByName(augmentedProgram.name, function(err, entity) {
//                     if (err) return cb(err)
//                     if (!entities[augmentedProgram.offset]) entities[augmentedProgram.offset] = []
//                     entities[augmentedProgram.offset].push(entity)
// 
//                     done(null, entities)
//                 })
//             })
//         })
//     })
// }

