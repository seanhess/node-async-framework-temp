
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

exports.callWithPromise = function(assert) {
    function getStuff(cb) {
        cb(null, {name: "bobby"})
    }

    function echo(param, cb) {
        process.nextTick(function() {
            cb(null, param)
        })
    }

    var actions = as(getStuff, echo, function(getStuff, echo) {
        var stuff = getStuff()
        var result = echo(stuff.name)
        return result
    })

    actions(function(err, stuff) {
        assert.ifError(err)
        assert.equal(stuff, "bobby")
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



exports.promisedParams = function(assert) {

    function getStuff(cb) {
        cb(null, "hello")
    }
    // got to get this working first
    var setStuff = as(getStuff, function(getStuff, doc) {
        doc.stuff = getStuff()
    })

    var doc = {name:"me"}
    setStuff(doc, function(err, value) {
        assert.ifError(err)
        assert.deepEqual(doc, {name:"me", stuff:"hello"})
        assert.finish()
    })
}


// common thing to do!
exports.forEach = function(assert) {

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

    var actions = as(getDocs, getTagsForDoc, function(getDocs, getTagsForDoc) {
        var docs = getDocs()

        docs.forEach(function(doc) {
            doc.tags = getTagsForDoc(doc)
        })

        return docs
    })

    actions(function(err, val) {
        assert.ifError(err)
        assert.deepEqual(val[0], {id:1, tags:["a","b","c"]})
        assert.finish()
    })
}

exports.map = function(assert) {

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

    var actions = as(getDocs, getTagsForDoc, function(getDocs, getTagsForDoc) {
        var docs = getDocs()

        var arrayOfTagsArrays = docs.map(function(doc) {
            return getTagsForDoc(doc)
        })

        return arrayOfTagsArrays
    })

    actions(function(err, val) {
        assert.ifError(err)
        assert.deepEqual(val[0], ["a","b","c"])
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

