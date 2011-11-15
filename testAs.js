
if (module == require.main) 
    require("async_testing").run([__filename], function() {})

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

        saveThing: function (thing, cb) {
            delay(function() {
                fakeDb[name] = thing
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
var as = require("./")

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
        for (var i = 0; i < 100; i ++)
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
        console.log(val)
        assert.equal(val, "bob")
        assert.finish()
    })

}

return
// try an async and sync sub-function
exports.accessSubFunctionOfPromise = function(assert) {
    assert.ok(false, "Todo")
    assert.finish()
}

exports.readFromDbSetPropThenSaveThenRead = function(assert) {
    // means you have to figure out how to get it to "set" on a promise
    // not hard, just make a fake function that sets on the param, run it like normal
    assert.ok(false, "Todo")
    assert.finish()
}

exports.convertEntireModules = function(assert) {
    assert.ok(false, "Todo")
    assert.finish()
}

exports.convertModulesOutside = function(assert) {
    assert.ok(false, "Todo")
    assert.finish()
}

exports.getExtraDataForEachItem = function(assert) {

    // var docs = getDocs() // id, name
    // var tags = getTagsForDocs() // tag, then attach to each one
    // return { id: [tag], etc }
    
    assert.ok(false, "Create a new object with keys for each one?")
    assert.finish()
}

exports.conditionalEscaping = function(assert) {
    assert.ok(false, "If you get nothing back from a db, return early")
    assert.finish()
}

exports.conditionalDefaults = function(assert) {
    assert.ok(false, "If you get nothing back from a db, use a default value instead")
    assert.finish()
}

exports.errors = function(assert) {
    assert.ok(false, "Make sure you catch errors and escape early")
    assert.finish()
}

exports.lists = function(assert) {
    assert.ok(false, "Take a list of ids and turn them into a list of objects in the same order")
    assert.finish()
}

exports.asyncMap = function(assert) {
    assert.ok(false, "Make it so you can map an array of somethings async style")
    assert.finish()
}

exports.asyncForEach = function(assert) {
    assert.ok(false, "Make it so you can async loop through something and modify each item")
    assert.finish()
}

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

// NEXT: Make promises be proxies, so you can do ret.something() or whatever
// so you can do sub-objects, etc. 

// Right now I just support function calls. Maybe that's enough ?
// Cause you can do everything else in a function

return

// test promise creation / chaining, etc
exports.promise = function(assert) {


    // Ok, really, it's a series of steps with possible dependencies. 
    // So I can't really do this separately
    // what I CAN do is make sure the steps execute in series, then start adding dependencies





    


    // test resolution 1 deep
    var b = as.binding()
    b.source({bob: 20})
    var r = b.resolve()
    assert.ok(r)
    assert.equal(r.bob, 20)


    // test resolution of 1 promise, source swapping
    var bob = b.bob
    b.source({bob: 20})
    r = bob.resolve()
    
    assert.ok(r)
    assert.equal(r, 20)

    b.source({bob: 30})
    assert.equal(bob.resolve(), 30)


    // test setting stuff
    b.henry = 40
    b.ugly = "ugly"

    // now, when I resolve b, it should resolve all of those, don't you think?
    // only if I force them to resolve too
    // I can't get the result of them, but they ARE created. 

    // I mean, b could keep track of them. 

    // and what about function invocations

    b.charlie() // means to call charlie!, well, kind of. I don't have to do it right away

    // it means to call charlie once everything goes down
    // And I don't really want to make a binding system. It only needs to fire ... when the source is set, once. 

    // So, instead, I could make it the opposite
    // when you call .source, all of them fire at once, and update their values, or set their stuff
    // they'd have to fire IN ORDER though

    // So, when .source() is called, go through your child bindings and call all of them
    // its pretty simple, that way

    s.resolve()
    console.log(b.resolve())
    // assert.equal(b.resolve().henry, 40)



    assert.finish()
}

return

exports.simple = function(assert) {

    var db = makeFakeDb({bob:{name:"bob"}})

    // as makes a block of async actions, that run in sequence
    var actions = as(db, function(db) {
        var bob = db.fetch("bob")
        bob.mood = "angry"
        db.save(bob)

        return db.fetch("bob")
    })

    // you can pass them a callback
    actions(function(err, bob) {
        assert.equal(bob.name, "bob", "Bob was not bob: " + bob.name)
        assert.equal(bob.mood, "angry")
        assert.finish()
    })
}


// exports.assumeSequenceBreaks = function(assert) {
// 
//     // You can't assume sequence, because how does it know you've finished with your function?
//     // You can't put the burden on the user. He'll forget
//     // So, assuming sequence is dangerous
// 
//     // Ooh, so the queue is defined for that block
//     // we process.nextTick everything so nothing can resolve during the block, it just creates an array of promises
//     // then we execute away!
// 
//     var db = makeFakeDb({bob:{name:"bob"}})
// 
//     // makes a function you can call at ANY time. 
//     // accepts params, along with an invisible one (a callback)
//     var actions = makeDo(assert, db, function(assert, db) {
//         var bob = db.fetch("bob")
//         bob.mood = "angry"
//         db.save(bob)
// 
//         var bob = db.fetch("bob")
//         var last = assert.equal(bob.name, "bob", "Bob was not bob: " + bob.name)
// 
//         assert.equal(bob.mood, "angry")
//     })
// 
//     actions(assert.finish)
// 
//     // knows it is a do function // so you don't have to use do() inside of it
//     // automatically does it on each of its parameters
// 
//     // You would have to have called makeDo on any globals before-hand
// 
//     // this passes an error to the caller, but what about the above? 
//     // we'll need an error handler somewhere. Well, assert.finish() is unique, usually
//     // wait, it's easy, isn't it? 
//     // You'd call cb with the param?
// 
//     // No, it needs to know how to handle errors
// 
//     // But I think this should be the standard syntax
// 
//     var runTest = do(function(assert, db) {
//         var bob = db.fetch("bob")
//         bob.mood = "angry"
//         db.save(bob)
// 
//         var bob = db.fetch("bob")
//         var last = assert.equal(bob.name, "bob", "Bob was not bob: " + bob.name)
// 
//         assert.equal(bob.mood, "angry")
//         return true
//     })
// 
//     runTest(assert, db, function(err, lastResult) {
//         assert.ifError(err)
//         assert.finish()
//     })
// }
// 
// // any globals must already be doified
// var db = makeFakeDb({bob:{name:"bob"}})
// 
// exports.doifiedTest = makeDo(db, function(db, assert) {
//     var bob = db.fetch("bob")
//     bob.mood = "angry"
//     db.save(bob)
// 
//     var bob = db.fetch("bob")
//     var last = assert.equal(bob.name, "bob", "Bob was not bob: " + bob.name)
// 
//     assert.equal(bob.mood, "angry")
//     assert.finish()
// })

