# The Framework (currently called as)

Uses node-proxy to allow you to write asynchronous code as if it were synchronous. See example.js. As means "asynchronous".

    var as = require('as')
    var fs = require('fs') 

    var copyFile = as(fs, function(fs, source, dest) { 
        var contents = fs.readFile(source) 
        fs.writeFile(dest, contents) 
        return true // = cb(err, true) 
    }) 

    copyFile("source.txt", "dest.txt", function(err, success) { 
        console.log(err, success) 
    }) 
