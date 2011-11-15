

Proxy = require 'node-proxy'

# We use a global queue to track promises being created
# since promise creation always occurs in a single run of the event loop, it works
currentPromises = []

as = module.exports = (objects..., actions) ->
    # step 1, create a function, that returns magic objects for each object
    # actions.apply(null, objects.map(objPromise))

    # while the function runs, all created promises go into our queue (globally)
    currentPromises = []
    ret = actions.apply null, objects.map convert
    ps = currentPromises
    currentPromises = []

    return (cb) ->
        runPromises ps.concat(), (err) -> 
            if err then return cb err
            cb null, promiseValue ret

as.convert = convert = (obj) ->
    if typeof obj == "function"
        return (args...) -> 
            p = promise obj, args
            currentPromises.push p
            p
    else if typeof obj == "object"
        promiser = {}
        for key, value of obj
            promiser[key] = convert value
        promiser
    else obj


runPromises = (ps, cb) ->
    console.log("RUN PROMiSES", ps)
    parallels = []

    flushParallels = (cb) ->
        runParallel parallels, cb
        parallels = []
        
    next = (err) ->
        if err then return cb err

        p = ps.shift()

        if not p? 
            return flushParallels cb

        if p.parallel 
            parallels.push p
            return next()

        flushParallels (err) -> 
            if err then return cb err
            runPromise p, next

    next()

runParallel = (ps, cb) ->
    if ps.length == 0 then return cb()
    remaining = ps.length
    ps.forEach (p) -> 
        runPromise p, (err) ->
            if (err) then return cb err
            if --remaining == 0
                cb()

runPromise = (p, cb) ->
    console.log "Run Promise", p

    # this function set up both a callback AND checks for the return. It shouldn't do both
    # If return is called, throw an error

    finished = false
    callback = (err, result) ->
        if finished then throw new Error "Promise both returned and called back, or called back twice"
        finished = true
        p.done result
        process.nextTick -> cb err, result
    callback.inspect = -> "" # so it won't show up in traces

    p.args.push callback
    ret = p.action.apply p, p.args.map promiseValue
    if ret? then callback null, ret

promiseValue = (p) -> 
    # if it is a promise, then return
    if p? and p.isPromise then return p.value()

    # if it is an object, support a single level of nesting
    for prop, val of p
        if val.isPromise then p[prop] = val.value()

    p




# Promises have to be a proxy, so you can get sub-values as promises
# see if you can get that to work, and have previous tests pass

as.promise = promise = (action, args) ->
    makeProxy new Promise action, args

makeProxy = (p) ->
    handler =
        get: (r, n) -> 
            if p[n]? then ensureBoundFunction p, p[n]
            else 
                binding = new Binding p, (val) -> val[n]
                currentPromises.push binding
                makeProxy binding

        # return a promise to set stuff
        # hmm, it might be easier to do get/call this way too
        # except that if they're not used, they won't even be executed :)
        set: (r, n, v) -> 
            currentPromises.push new Promise ->
                dest = p.value()
                if not dest? then return null

                if v.isPromise
                    v = v.value()

                dest[n] = v

        call: (r) -> 
            binding = new Binding p, (val) -> val()
            currentPromises.push binding
            makeProxy binding

    proxy = Proxy.createFunction handler, handler.call


class Promise
    constructor: (action, args) -> 
        @action = action || ->
        @args = args || []
        @val = null
        @parallel = false
    p: -> @parallel = true; this
    done: (v) -> @val = v
    value: -> @val
    inspect: -> inspectFunction @action, @args
        
    isPromise: true

class Binding extends Promise
    constructor: (parent, getValue) ->
        @parent = parent
        @val = null
        @args = []
        @getValue = getValue
        @action = @run
    done: -> # ignore done, the value isn't correct
    inspect: -> "{ Binding #{@parent.value()} #{@val}}"
    run: (cb) -> 
        parentValue = @parent.value()
        if parentValue? then @val = @getValue parentValue else null
        cb()
        return undefined # so it isn't treated as a return 


# HELPERS #
# If a function, makes sure it is bound to object
ensureBoundFunction = (p, value) ->
    if value instanceof Function 
        value = value.bind p
    return value

inspectArgs = (args) ->
    mapped = args.map (arg) ->
        if arg.inspect? 
            arg.inspect() 
        else if typeof arg == 'function'
            inspectFunction arg, []
        else arg
    mapped.join ','

inspectFunction = (f, args) ->
    f.toString().replace(/function\s*(\w*).*?\s*\{[\s\S]+/, "$1") + "(" + inspectArgs(args) + ")"











































# this only has to wrap functions? Or should I just make it a full-on promise?
# full-on promise
# this isn't even really a promise, it's like a value proxy

# it's a data binding!
# binding = as.binding = (bind) ->
# 
#     call = -> false
# 
#     handler = {
#         get: (r, n) -> 
#             if bind[n]? then bind[n].bind(bind) # this is lame
#             else if n == "_" then bind
#             else binding bind, (src) -> src[n]
#     
#         set: (r, n, v) -> 
#             binding bind, (src) -> src[n] = v
#     }
#     
#     return Proxy.createFunction(handler, call)
# 
# 
# class Binding
#     constructor: (source, action) ->
#         @src = source
#         @act = action  
#     source: (s) -> 
#         @src = s
#     resolve: -> 
#         source = if @src instanceof Binding then @src.resolve() else @src
#         if @act? then @act source else source
#         # resolveSource = (source) ->
#             # source.resolve()
# 
#         # if @action then @action resolveSource(source)
#         # else @src # so action is based on the source


# # just store what happens, I guess
# # the target can be null, a promise, or anything
# # but don't resolve it yet :)
# class Promise
#     target: null
#     action: null




