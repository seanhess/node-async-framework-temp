# Allows you to call a function via a prototype
# assumes the object is the last argument

toProto = exports.toProto = (method) ->
    return -> 
        Array.prototype.unshift.call arguments, this
        method.apply null, arguments

# Adds a non-enumerable method to a prototype using the toProto style
addToProto = exports.addToProto = (Class, name, method) ->
    if Class.prototype[name] then return
    Object.defineProperty Class.prototype, name, { 
       value: toProto method 
    }

copy = exports.copy = (obj) ->
    innerCopy = {}
    for prop, value of obj
        innerCopy[prop] = value
    innerCopy

# Partially apply a function
partial = exports.partial = (f, args...) -> 
    applied = (finalArgs...) ->
        f.apply null, args.concat(finalArgs)
    
# Partially applies a function from the right. Right-most param is right-most in the final call
partialr = exports.partialr = (f, args...) ->
    applied = (finalArgs...) ->
        f.apply null, finalArgs.concat(args)

addToProto Function, "partial", partial
addToProto Function, "partialr", partialr
