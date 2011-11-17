
// Pretend express route:
var as = require('./')
var fs = require('fs')
var path = require('path')


// SCORES EXAMPLE
var Scores = {
    getScores: function(cb) {
        process.nextTick(function() {
            cb(null, [{id:1, score:200}, {id:2, score:300}])
        })
    }
}

AScores = as.convert(Scores)



exports.scoresBefore = function(req, res) {
    Scores.getScores(function(err, scores) {
        if (err) return res.send(err)
        res.render("weights", {scores: scores})    
    })
}

// Create a cb-style function, then turn it into an express route
// note that this example uses the global-style async version of the module
exports.scoresAfter = routeHandler(as(function(req, res) {
    var scores = AScores.getScores()
    res.render("weights", {scores:scores})
}))




// ENTITY EXAMPLE
var Entity = {
    mock: {
        "one": {name: "one"},
        "two": {name: "two"},
        "three": {name: "three"}
    }
}

var AugmentedProgram = {
    mock: [
        {name: "one", offset: 1},
        {name: "two", offset: 2},
        {name: "three", offset: 2}
    ]
}

Entity.findByProgramBefore = function(programId, cb) {

    AugmentedProgram.findByProgram(programId, function(err, augmentedPrograms) {
        if (!augmentedPrograms.length) return cb(null, {}) // otherwise the loop below won't finish
        var entities = {}
        var processed = 0

        augmentedPrograms.forEach(function(augmentedProgram) {
            Entity.findByName(augmentedProgram.name, function(err, entity) {
                if (err) return cb(err)
                if (!entities[augmentedProgram.offset]) entities[augmentedProgram.offset] = []
                entities[augmentedProgram.offset].push(entity)

                if (++processed == augmentedPrograms.length)
                    cb(null, entities)
            })
        })
    })
}

// Use a pure function to do your fancy stuff!
// uses the parameter style of asyncifying modules
Entity.findByProgram = as(Entity, AugmentedProgram, function(Entity, AugmentedProgram, programId) {
    var programs = AugmentedProgram.findByProgram(programId)
    var entitiesWithOffsets = programs.map(function(program) {
        var entity = Entity.findByName(program.name)
        return {offset: program.offset, entity: entity} // we'll need both to sort, below
    })
    return Entity.groupByOffset(entitiesWithOffsets)
})

Entity.groupByOffset = function(entitiesAndOffsets) {
    var offsets = {}

    entitiesAndOffsets.forEach(function(e) {
        if (!offsets[e.offset]) offsets[e.offset] = []
        offsets[e.offset].push(e.entity)
    })

    return offsets
}

Entity.findByName = function(name, cb) {
    process.nextTick(function() {
        cb(null, Entity.mock[name]) 
    })
}

AugmentedProgram.findByProgram = function(programId, cb) {
    process.nextTick(function() {
        cb(null, AugmentedProgram.mock)
    })
}


// FS EXAMPLE - concat all js files in a directory and save to filename
exports.fsBefore = function(dir, destFile, cb) {
    fs.readdir(dir, function(err, files) {
        if (err) return cb(err)

        // Filter *.js files
        files = files.filter(function (name) {
            return (name.slice(-3) === '.js');
        });

        // Read all the files
        var fileContents = []
        function getContentsOfAllFiles(cb) {
            files.forEach(function(file) {
                var fullPath = path.join(dir, file)
                fs.readFile(fullPath, 'utf-8', function(err, contents) {
                    if (err) return cb(err)
                    fileContents.push(contents)
                    if (fileContents.length == files.length)
                        cb(null, fileContents)
                })
            })
        }

        getContentsOfAllFiles(function(err, contents) {
            if (err) return cb(err)

            // Join them all together
            var combined = contents.join("\n")

            // Save them
            fs.writeFile(destFile, combined, 0775, cb)
        })
    })
}


exports.fsAfter = as(fs, path, function(fs, path, dir, destFile) {
    var files = fs.readdir(dir)
    files = files.filter(function (name) {
        return (name.slice(-3) === '.js');
    });

    var contents = files.map(function(file) {
        var fullPath = path.join(dir, file)
        return fs.readFile(fullPath, 'utf-8')
    })

    var combined = contents.join("\n")

    fs.writeFile(destFile, combined, 0775)
})


exports.fsAfterChained = as(fs, path, function(fs, path, dir, destFile) {
    var combined = fs
        .readdir(dir)
        .filter(function (name) {
            return (name.slice(-3) === '.js');
        })
        .map(function(file) {
            var fullPath = path.join(dir, file)
            return fs.readFile(fullPath, 'utf-8')
        })
        .join("\n")

    fs.writeFile(destFile, combined, 0775)
})




















// Since as expects a cb-like function, we need to make a function that returns an express route
// and wraps a continuation-style functon
function routeHandler(actions) {
    return function(req, res) {
        actions(req, res, function(err, settings) {
            if (err) return res.send(err) // catch the error
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









if (module == require.main) {
    var ex = makeFakeCall()
    exports.scoresBefore(ex.req, ex.res)
    exports.scoresAfter(ex.req, ex.res)

    Entity.findByProgram("fakeId", function(err, entities) {
        console.log(err, entities)
    })

    Entity.findByProgramBefore("fakeId", function(err, entities) {
        console.log(err, entities)
    })

    exports.fsAfterChained(__dirname, "/tmp/file.js", function(err) {
        console.log("Wrote /tmp/file.js")
    })
}


