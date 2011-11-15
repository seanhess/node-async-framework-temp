

Proxy = require 'node-proxy'
common = require './common'
events = require 'events'

as = module.exports = (objects..., actions) ->
    # step 1, create a function, that returns magic objects for each object
    # actions.apply(null, objects.map(objPromise))

    ps = []
    mappedFunctions = functionToPromiser.partial ps
    ret = actions.apply(null, objects.map(mappedFunctions))

    return (cb) ->
        runPromises ps.concat(), (err) -> 
            # console.log("RETURNING", ret, ret.value())
            if err then return cb err
            cb null, promiseValue ret

# function that creates a promise to do f
functionToPromiser = (queue, f) ->
    return (args...) -> 
        p = promise f, args
        queue.push p
        p

runPromises = (ps, cb) ->
    # console.log("RUN PROMiSES", ps)
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
    # console.log "RUN PARALLEL", ps
    if ps.length == 0 then return cb()
    remaining = ps.length
    ps.forEach (p) -> 
        runPromise p, (err) ->
            if (err) then return cb err
            if --remaining == 0
                cb()

runPromise = (p, cb) ->
    # console.log "Run Promise", p

    p.args.push (err, result) ->
        p.done result
        cb err, result
        
    ret = p.action.apply null, p.args.map promiseValue

    if ret? 
        p.done ret
        process.nextTick -> cb null, ret

promiseValue = (p) -> 
    # if it is a promise, then return
    if p? and p.value? then return p.value()

    # if it is an object, support a single level of nesting
    for prop, val of p
        if val.value? then p[prop] = val.value()

    p




# Promises have to be a proxy, so you can get sub-values as promises
# see if you can get that to work, and have previous tests pass

as.promise = promise = (action, args) ->
    makeProxy new Promise action, args

makeProxy = (p) ->
    handler =
        get: (r, n) -> 
            if p[n]? then ensureBoundFunction p, p[n]
            else makeProxy withValue p, (val) -> val[n]

        set: (r, n, v) -> p.on 'done', (val) -> 
            if val? then val[n] = v

        call: (r) -> makeProxy withValue p, (val) -> val()

    proxy = Proxy.createFunction handler, handler.call


class Promise extends events.EventEmitter
    constructor: (action, args) -> 
        @action = action
        @args = args || []
        @val = null
        @parallel = false
    p: -> 
        @parallel = true
        this
    done: (v) -> 
        @val = v
        @emit 'done', v
    value: -> @val
    inspect: -> "[Promise action:#{@action.toString().replace(/\ *{[\s\S]*/, '')} args:#{@args} value:#{@val} #{if @parallel then 'p' else ''}]"











# HELPERS #

# return an object with a value function defined by f
# automatically handles nulls
withValue = (p, f) -> { 
    value: -> 
        val = p.value() 
        if val? then f val else null
}

# If a function, makes sure it is bound to object
ensureBoundFunction = (p, value) ->
    if value instanceof Function 
        value = value.bind p
    return value
















































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




