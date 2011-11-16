
// Pretend express route:
var as = require('./')

exports.scoresBefore = function(req, res) {
    Scores.getScores(function(err, scores) {
        if (err) return res.send(err)

        res.render("weights", {
            scores: scores
        })    
    })
}

// I need an adapter for express
exports.scoresAfter = routeHandler(as(function(req, res) {
    console.log("CHECK ", res.render)
    var scores = AScores.getScores()
    res.render("weights", scores)
}))



// create a function to wrap an as thing that will make it work like magic
function routeHandler(actions) {
    return function(req, res) {
        actions(req, res, function(err, settings) {
            if (err) return res.send(err)
        })
    }
}





var makeFakeCall = function(params) {
    params = params || {}
    return {
        req: {
            params: params
        },

        res: {
            render: function(view, settings) {
                console.log("RENDER", view, settings) 
            }
        }
    }
}





var Scores = {
    getScores: function(cb) {
        process.nextTick(function() {
            cb(null, [{id:1, score:200}, {id:2, score:300}])
        })
    }
}

AScores = as.convert(Scores)


if (module == require.main) {
    var ex = makeFakeCall()
    exports.scoresBefore(ex.req, ex.res)
    exports.scoresAfter(ex.req, ex.res)
}


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


