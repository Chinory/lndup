#!/usr/bin/env node
/*lndup cmd.js <https://github.com/chinory/lndup>*/
'use strict';

const path=require('path');

var argv = (function(a){
    for(var r=new Map(),c,i=0;i<a.length&&a[i].length>1&&a[i].startsWith("-");++i){
        if(a[i].startsWith("--"))
        {if(a[i].length > 2)r.set(a[i].slice(2));else{++i;break}}
        else for(c of a[i].slice(1))r.set(c);
    }return r.set('', a.slice(i));
})(process.argv.slice(2));

console.log(argv);