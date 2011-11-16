

Proxy = require 'node-proxy'

# We use a global queue to track promises being created
# since promise creation always occurs in a single run of the event loop, it works
currentPromises = []
creatingActions = false

as = module.exports = (objects..., actions) ->

    # I'll have to create all the promises right before running
    # this makes sense anyway, because otherwise they might be all full of values from the last time
    createActions = (args...) ->
        oldCurrentPromises = currentPromises
        currentPromises = []
        creatingActions = true
        ret = actions.apply null, objects.map(convert).concat(args)
        ps = currentPromises
        currentPromises = oldCurrentPromises
        creatingActions = false
        return [ret, ps]

    runActions = (args..., cb) ->

        # we're calling an asyncified function while creating actions. convert it and run it!
        if creatingActions
            converted = convert runActions
            return converted.apply null, args.concat(cb)

        [ret, ps] = createActions.apply null, args

        # console.log "RUN", args

        if not cb? then throw new Error "Tried to call async block with no callback"

        runPromises ps.concat(), (err) -> 
            # console.log "DONE RUN", err, ret
            if err then return cb err
            cb null, promiseValue ret
        return undefined # otherwise we can't chain them together


    

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
    # console.log("RUN PROMISES", ps)
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

    # make sure we're referencing the promise object and not the proxy
    p = p.source()

    # this function set up both a callback AND checks for the return. It shouldn't do both
    # If return is called, throw an error

    # console.log "RUN PROMISE", p

    finished = false
    callback = (err, result) ->
        if finished then throw new Error "Promise both returned and called back, or called back twice"
        finished = true
        p.value = result
        # console.log "RAN PROMISE", p
        process.nextTick -> cb err
    callback.inspect = -> "" # so it won't show up in traces

    if p.type == "NORMAL"
        args = p.args.concat()
        args.push callback
        args = args.map promiseValue
        ret = p.action.apply p, args # in normal mode, check ret
        if ret? then callback null, ret

    else
        parentValue = p.parent.value || {}

        ret = switch p.type
            when "GET" then parentValue[p.property] 
            when "SET" then parentValue[p.property] = promiseValue p.setTo
            when "CALL" then parentValue.apply p.parent.parent.value, p.args # you have to apply two-levels in, the immediate parent is the function wrapper itself
            else throw new Error "Bad Promise Type"

        callback null, ret
    


promiseValue = (p) -> 
    # console.log "PROMISe VALUE", p, p.value
    # if it is a promise, then return
    if p? and p.isPromise then return p.source().value

    # if it is an object, support a single level of nesting
    for prop, val of p
        if val.isPromise then p[prop] = val.source().value

    p




# Promises have to be a proxy, so you can get sub-values as promises
# see if you can get that to work, and have previous tests pass

as.promise = promise = (action, args) ->
    makeProxy Promise.Normal action, args

makeProxy = (p) ->
    handler =
        get: (r, n) -> 
            # console.log "GET", n
            if p[n]? then ensureBoundFunction p, p[n]
            else 
                getter = Promise.Getter p, n
                currentPromises.push getter
                # console.log "MADE GETTER"
                makeProxy getter

        # return a promise to set stuff
        # hmm, it might be easier to do get/call this way too
        # except that if they're not used, they won't even be executed :)
        set: (r, n, v) -> 
            setter = Promise.Setter p, n, v
            currentPromises.push setter

        call: (args...) -> 
            # bindings don't partially apply arguments!
            # Oh, wait, I need the args of call, no?
            caller = Promise.Caller p, args
            currentPromises.push caller
            makeProxy caller

    proxy = Proxy.createFunction handler, handler.call


class Promise
    constructor: () -> 
        @parent = {}
        @args = []
        @value = null
        @parallel = false
        @action = null

        @type = null
        @property = null # name of property to get/set
        @setTo = null # promise to set to

    isPromise: true

    # puts the promise into parallel mode
    p: -> @parallel = true; this

    # allows you to access the internal object, rather than the proxy
    source: -> this

    inspect: -> inspectPromise this

Promise.Getter = (parent, n) ->
    p = new Promise()
    p.parent = parent
    p.type = "GET"
    p.property = n
    p

Promise.Setter = (parent, n, v) ->
    p = new Promise()
    p.type = "SET"
    p.parent = parent
    p.property = n
    p.setTo = v
    p

Promise.Caller = (parent, args) -> # calls the parent
    p = new Promise()
    p.type = "CALL"
    p.parent = parent
    p.args = args
    p

Promise.Normal = (action, args) -> # calls the passed in function
    p = new Promise()
    p.type = "NORMAL"
    p.args = args
    p.action = action
    p














# HELPERS #
# If a function, makes sure it is bound to object
ensureBoundFunction = (p, value) ->
    if value instanceof Function 
        value = value.bind p
    return value

inspectObj = (arg) ->
    if arg.inspect? 
        arg.inspect() 
    else if typeof arg == 'function'
        inspectFunction arg, []
    else arg

inspectArgs = (args) ->
   args.map(inspectObj).join ','

inspectFunction = (f, args) ->
    # f.toString()
    f.toString().replace(/function\s*(\w*).*?\s*\{[\s\S]+/, "$1") + "(" + inspectArgs(args) + ")"

inspectPromise = (p) -> 
    out = ""
    out += inspectPromiseNoValue p
    if p.value? then out += " = " + inspectObj(p.value)
    out

inspectPromiseNoValue = (p) ->
    if not (p instanceof Promise) then return ""

    out = "" 
    if p.parent? then out += inspectPromiseNoValue p.parent

    switch p.type 
        when "NORMAL" then if p.action? then out += inspectFunction p.action, p.args
        when "GET" then out += "." + p.property
        when "CALL" then out += "(" + inspectArgs(p.args) + ")"
        when "SET" then out += "." + p.property + " = " + p.setTo
        else throw new Error "Unknown p.type"

    out

 






















 
















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




