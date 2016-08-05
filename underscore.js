//     Underscore.js 1.8.3
//     http://underscorejs.org
//     (c) 2009-2016 Jeremy Ashkenas, DocumentCloud and Investigative Reporters & Editors
//     Underscore may be freely distributed under the MIT license.

(function() {
  // 要点1：使用立即执行函数防止全局作用域污染
  // Baseline setup
  // --------------

  // Establish the root object, `window` (`self`) in the browser, `global`
  // on the server, or `this` in some virtual machines. We use `self`
  // instead of `window` for `WebWorker` support.
  // 要点2：兼容浏览器和Node环境
  // 这里是为了兼容浏览器和服务器，即浏览器JavaScript和Node.js。在Node.js中表示global对象，在浏览器中表示window对象
  var root = typeof self == 'object' && self.self === self && self ||
            typeof global == 'object' && global.global === global && global ||
            this;

  // Save the previous value of the `_` variable.
  // 要点3：命名冲突解决方案
  // 将全局环境中的变量'_'赋值给previousUnderscore缓存，解决命名冲突问题 todo
  var previousUnderscore = root._;

  // Save bytes in the minified (but not gzipped) version:
  // 要点4：便于压缩(联想Angular代码压缩破坏依赖注入原因?)
  // 这样做可以进行压缩，ArrayProto在压缩时会以更小的字节数来表示，以此减少文件压缩后的字节数 todo
  var ArrayProto = Array.prototype, ObjProto = Object.prototype;
  var SymbolProto = typeof Symbol !== 'undefined' ? Symbol.prototype : null;

  // Create quick reference variables for speed access to core prototypes.
  // 要点5：减少在原型链中的查找次数(理解JavaScript的原型链！)
  // 简化操作，同样也能起到压缩代码的作用
  // todo 可以减少在原型链中的查找次数，提高代码效率
  var push = ArrayProto.push,
      slice = ArrayProto.slice,
      toString = ObjProto.toString,
      hasOwnProperty = ObjProto.hasOwnProperty;

  // All **ECMAScript 5** native function implementations that we hope to use
  // are declared here.
  // ES5原生方法，如果浏览器支持则优先使用下面的方法 todo
  var nativeIsArray = Array.isArray,
      nativeKeys = Object.keys,
      nativeCreate = Object.create;

  // Naked function reference for surrogate-prototype-swapping.
  // 构造器
  var Ctor = function(){};

  // Create a safe reference to the Underscore object for use below.
  // 创建一个安全的对underscore对象的引用
  // 要点6：JavaScript多种函数调用问题
  // functon sum(a, b) { return a + b; }
  // var x = new sum(10, 2);
  // console.log(x)  ->  sum{}
  // console.log(x instance of sum)  ->  true
  // to let x get a result, we can do this
  // function sum(a, b) {
  //  if(this instance of sum) { this.result = a + b; }
  //  else { return a + b; }
  // }
  // console.log(x) -> sum{result: 12} // with a result;
  // more => http://stackoverflow.com/questions/16021460/this-in-function-from-underscore-js
  // 如果函数被当作构造器使用，那么函数里的this将指向刚刚新建的对象
  // function Panel() {
  //  if (this instanceof Panel) {
  //      return this; // `new` operator was used
  //   } else {
  //       return new Panel(); // called without `new`, so we create a new object
  //   }
  // }
  // TODO
  var _ = function(obj) {
    // 如果obj已经是一个_实例，则直接返回
    if (obj instanceof _) return obj;
    // 如果有人调用了这个函数，即called `_(...)` rather than `new _(...)`,那么新建一个实例后返回这个实例
    // var under = _();
    if (!(this instanceof _)) return new _(obj);
    // 构造器构造
    // var under = new _();
    // this指向under
    this._wrapped = obj;
  };

  // Export the Underscore object for **Node.js**, with
  // backwards-compatibility for their old module API. If we're in
  // the browser, add `_` as a global object.
  // (`nodeType` is checked to ensure that `module`
  // and `exports` are not HTML elements.)
  // 针对不同环境把Underscore的命名变量存放到不同的对象中
  // 针对Node.js进行导出，两种方式导出以兼容老的服务端环境
  // 对于浏览器则直接放到全局对象即windows下面
  // exports.nodeType使用来确保module和exports不是HTML元素，即保证是处在node环境下
  if (typeof exports != 'undefined' && !exports.nodeType) {
    if (typeof module != 'undefined' && !module.nodeType && module.exports) {
      exports = module.exports = _;
    }
    exports._ = _;
  } else {
    root._ = _;
  }

  // Current version.
  _.VERSION = '1.8.3';

  // Internal function that returns an efficient (for current engines) version
  // of the passed-in callback, to be repeatedly applied in other Underscore
  // functions.
  // 要点7：用void 0 替代 undefined
  // ES5开始undefined是全局对象的只读属性，不能被重写，但在局部作用域中仍然可被重写
  // The void operator evaluates the given expression and then returns undefined.
  // void运算符能对给定的表达式进行求值，然后返回undefined，可以避免出现重写问题，void不能被重写
  // 之所以是跟0,是因为0短并且被惯用，用其他也是可以的，在代码进行压缩的时候undefined会被void 0代替一个原因就是减少字节数
  // 要点8: 区分apply和call，联系bind。
  // call和apply都是改变某个函数运行时的context即上下文而存在的，即改变函数体内部this的指向，他们的区别在于接收的参数上
  // 例如对于var func1 = function(arg1, arg2){};
  // 可以通过func1.call(this, arg1, arg2) 或 func1.apply(this, [arg1, arg2])来调用。this是你想指定的上下文
  // 当确定参数数量时用call，不确定参数数量的时候用apply，把参数push到数组传进去
  // https://www.zhihu.com/question/20289071
  
  // 这个函数是用来执行函数并改变所执行函数的作用域的，优化回调函数，call方法减小开销
  // 尽量指定参数而不是用arguments
  // 其实本质就是bind
  var optimizeCb = function(func, context, argCount) {
    // context是函数执行上下文即this, argCount是参数个数？
    if (context === void 0) return func;        // undefined === void 0    undefined == null
    switch (argCount == null ? 3 : argCount) {  // 如果argCount不为null，则调用相应case，否则调用3
      // 1的情况是接受单值的情况，比如times, sortedIndex之类的函数
      case 1: return function(value) {
        return func.call(context, value);
      };
      // The 2-parameter case has been omitted only because no current consumers
      // made use of it.
      // 3的情况用于迭代器函数，比如foreach, map, pick等
      case 3: return function(value, index, collection) {
        return func.call(context, value, index, collection);
      };
      // 4的情况用reduce和reduceRight函数
      case 4: return function(accumulator, value, index, collection) {
        return func.call(context, accumulator, value, index, collection);
      };
    }
    return function() {
      return func.apply(context, arguments);
    };
  };

  // 默认迭代行为
  var builtinIteratee;

  // An internal function to generate callbacks that can be applied to each
  // element in a collection, returning the desired result — either `identity`,
  // an arbitrary callback, a property matcher, or a property accessor.
  var cb = function(value, context, argCount) {
    // 如果改变了iteratee的行为，则返回自定义的iteratee
    if (_.iteratee !== builtinIteratee) return _.iteratee(value, context);
    // 没有传入value，返回当前迭代元素自身，比如var results = _.map([1,2,3]) => results: [1,2,3]
    if (value == null) return _.identity;
    // 是函数返回优化回调函数，比如var results = _.map([1,2,3], function(value, index, obj) {...})
    if (_.isFunction(value)) return optimizeCb(value, context, argCount);
    // 是对象返回一个能判断对象是否相等的函数，比如
    // var results = _.map([{name:'qq'},{name:'w',age:13}], {name:'w'}) => results: [false, true]
    if (_.isObject(value)) return _.matcher(value);
    // 返回获取对象属性的函数，比如
    // var results = _.map([{name: 'qq'}, {name: 'ww'}], 'name') => results: ['qq', 'ww']
    return _.property(value);
  };

  // External wrapper for our callback generator. Users may customize
  // `_.iteratee` if they want additional predicate/iteratee shorthand styles.
  // This abstraction hides the internal-only argCount argument.
  // 改变迭代过程中的行为
  _.iteratee = builtinIteratee = function(value, context) {
    return cb(value, context, Infinity);
  };

  // Similar to ES6's rest param (http://ariya.ofilabs.com/2013/03/es6-and-rest-parameter.html)
  // This accumulates the arguments passed into an array, after a given index.
  // ES6 Rest Parameters: var f = function(a, b, ...theArgs){};
  // f(1, 2, 3, 4, 5)  ->  a=1, b=2, theArgs=[3, 4, 5]
  // 把func的参数改造成Rest Parameters
  // 要点9：区别function.length和arguments.length
  // function.length排除Rest Paramters   (function(...args){}).length -> 0
  // function.length排除有默认值的变量后面的全部变量 (function(a, b=1, c){}).length -> 1
  // arguments.length是实际传入的参数数量
  var restArgs = function(func, startIndex) {
    // 如果未传入参数startIndex，func.length取得函数参数个数
    // 如果传入了startIndex，则取startIndex
    // 要点10：用`+`来将字符串数字转为真正的数字
    // 带上`+`可能是为了把形如"4"这样的变成4(兼容字符串数字)
    startIndex = startIndex == null ? func.length - 1 : +startIndex;
    return function() {
      // 这个是获取剩余参数的长度
      var length = Math.max(arguments.length - startIndex, 0);
      // 开辟一个数组，数组内容为length个undefined
      var rest = Array(length);
      // 把剩余参数一一赋给rest
      for (var index = 0; index < length; index++) {
        rest[index] = arguments[index + startIndex];
      }
      // 要点11：尽量使用call方法代替apply方法
      // call会比apply快很多，所以尽量使用call方法，但我们不可能写出全部case，所以这里大于3后用apply，
      // 之所以选择3后使用apply应该是代码量和使用频率的权衡
      // 之所以apply比call慢可以参考
      // https://stackoverflow.com/questions/23769556/why-is-call-so-much-faster-than-apply/23770316#23770316
      switch (startIndex) {
        case 0: return func.call(this, rest);
        case 1: return func.call(this, arguments[0], rest);
        case 2: return func.call(this, arguments[0], arguments[1], rest);
      }
      var args = Array(startIndex + 1);
      for (index = 0; index < startIndex; index++) {
        args[index] = arguments[index];
      }
      args[startIndex] = rest;
      return func.apply(this, args);
    };
  };

  // An internal function for creating a new object that inherits from another.
  // 创建一个继承prototype的新对象
  // 所有构造器/函数的__proto__都指向Function.prototype,是一个空函数
  // 所有对象的__proto__都指向其构造其的prototype
  // 所以这里通过新建一个构造器，构造器原型设置为给出的prototype，然后通过该构造器创建基于prototype原型的对象
  var baseCreate = function(prototype) {
    if (!_.isObject(prototype)) return {};
    if (nativeCreate) return nativeCreate(prototype);
    // 将函数Ctor的原型设置为prototype
    Ctor.prototype = prototype;
    // result讲得到一个对象，这个对象的原型是prototype
    var result = new Ctor;
    Ctor.prototype = null;
    return result;
  };

  /** 2016年7月28日 */

  // 这里的用法挺有意思的，比如对于一个对象student = {'age': 22, 'sex': 'male'}
  // 我们令var getAge = property('age')，
  // 也就是getAge = function(obj) { return obj == null ? void 0 : obj[key]; }
  // 接着我们就可以使用getAge(student)得到22
  // 如果key在我们调用的obj上不存在则会返回undefined
  var property = function(key) {
    return function(obj) {
      return obj == null ? void 0 : obj[key];
    };
  };

  // Helper for collection methods to determine whether a collection
  // should be iterated as an array or as an object.
  // Related: http://people.mozilla.org/~jorendorff/es6-draft.html#sec-tolength
  // Avoids a very nasty iOS 8 JIT bug on ARM-64. #2094
  var MAX_ARRAY_INDEX = Math.pow(2, 53) - 1;
  var getLength = property('length');
  // 判断一个集合是否是数组或伪数组
  var isArrayLike = function(collection) {
    // 具有length属性，如果不存在则为undefined
    var length = getLength(collection);
    return typeof length == 'number' && length >= 0 && length <= MAX_ARRAY_INDEX;
  };

  // Collection Functions
  // --------------------

  // The cornerstone, an `each` implementation, aka `forEach`.
  // Handles raw objects in addition to array-likes. Treats all
  // sparse array-likes as if they were dense.
  // 遍历操作数组/对象
  _.each = _.forEach = function(obj, iteratee, context) {
    // 如果制定了作用域context则绑定到iteratee
    // 优化回调，其实是优化函数调用，这个地方iteratee是传入函数 _.each(obj ,function(value, key, obj)) {...}
    iteratee = optimizeCb(iteratee, context);
    var i, length;
    if (isArrayLike(obj)) {
      for (i = 0, length = obj.length; i < length; i++) {
        // 迭代,iteratee实质是传入的函数，这里就是把值一一传进去调用该函数，上面的循环以完成迭代
        // 依次传入值，索引，迭代对象
        iteratee(obj[i], i, obj);
      }
    } else {
      var keys = _.keys(obj);
      for (i = 0, length = keys.length; i < length; i++) {
        // 依次传入传入值，键名，迭代对象
        iteratee(obj[keys[i]], keys[i], obj);
      }
    }
    return obj;
  };

  // Return the results of applying the iteratee to each element.
  // map和each相比，map是处理该对象/数组后以数组形式返回结果
  // 而each只是进行单纯的遍历对象
  _.map = _.collect = function(obj, iteratee, context) {
    iteratee = cb(iteratee, context);
    var keys = !isArrayLike(obj) && _.keys(obj),
        length = (keys || obj).length,
        results = Array(length);      // 创建定长数组，创建定长数组比追加数组性能消耗小很多
    for (var index = 0; index < length; index++) {
      var currentKey = keys ? keys[index] : index;
      results[index] = iteratee(obj[currentKey], currentKey, obj);
    }
    return results;
  };

  /** 2016年7月30日 */
  // Create a reducing function iterating left or right.
  // reduce函数的工厂函数，用于生成一个reducer，通过参数决定reduce的方向
  var createReduce = function(dir) {
    // Wrap code that reassigns argument variables in a separate function than
    // the one that accesses `arguments.length` to avoid a perf hit. (#1991)
    var reducer = function(obj, iteratee, memo, initial) {
      // keys是判断obj是否为对象，如果是对象则返回了obj的键名数组，否则返回false
      // dir如果为大于0,从左开始，否则从右开始
      var keys = !isArrayLike(obj) && _.keys(obj),
          length = (keys || obj).length,
          index = dir > 0 ? 0 : length - 1;
      // memo用来记录最新的reduce结果
      // 如果没有初始化则默认从首元素开始
      if (!initial) {
        // keys为false时取index，对数组处理
        // keys为键名数组时，取键名，对对象处理
        memo = obj[keys ? keys[index] : index];
        index += dir;
      }
      for (; index >= 0 && index < length; index += dir) {
        var currentKey = keys ? keys[index] : index;
        // 当前reduce结果，键名，键值，reduce对象
        memo = iteratee(memo, obj[currentKey], currentKey, obj);
      }
      return memo;
    };

    return function(obj, iteratee, memo, context) {
      // 第一次还没有memo，所以参数个数小于3,initial为false,表示未初始化
      // 之后initial保持为true，表示已经初始化过
      var initial = arguments.length >= 3;
      return reducer(obj, optimizeCb(iteratee, context, 4), memo, initial);
    };
  };

  // **Reduce** builds up a single result from a list of values, aka `inject`,
  // or `foldl`.
  // 从左reduce
  // 用法示例(想象下内部运行的过程)
  // var sum = _.reduce([1, 2, 3, 4, 5], function(accumulator, value, index, collection) {
  //   return accmulator;
  // }, 0);
  // Result: 15
  _.reduce = _.foldl = _.inject = createReduce(1);

  // 从右reduce
  // The right-associative version of reduce, also known as `foldr`.
  _.reduceRight = _.foldr = createReduce(-1);

  // Return the first value which passes a truth test. Aliased as `detect`.
  _.find = _.detect = function(obj, predicate, context) {
    // 如果是数组，找下标函数，如果是对象，找键值函数
    var keyFinder = isArrayLike(obj) ? _.findIndex : _.findKey;
    var key = keyFinder(obj, predicate, context);
    // 如果找到了返回这个键值
    if (key !== void 0 && key !== -1) return obj[key];
  };

  // Return all the elements that pass a truth test.
  // Aliased as `select`.
  // 下面这个很好理解了，遍历，判断是否符合predicate，符合则push进数组result，最后返回result
  _.filter = _.select = function(obj, predicate, context) {
    var results = [];
    predicate = cb(predicate, context);
    _.each(obj, function(value, index, list) {
      if (predicate(value, index, list)) results.push(value);
    });
    return results;
  };

  // Return all the elements for which a truth test fails.
  // 同上面，但返回的是不符合predicate的结果。
  // 通过negate把predicate变为一个优化过的返回与原predicate相反结果的函数
  _.reject = function(obj, predicate, context) {
    return _.filter(obj, _.negate(cb(predicate)), context);
  };

  // Determine whether all of the elements match a truth test.
  // Aliased as `all`.
  // 判断是否obj都满足predicate函数，如果有一个不符合则返回false
  _.every = _.all = function(obj, predicate, context) {
    predicate = cb(predicate, context);
    var keys = !isArrayLike(obj) && _.keys(obj),
        length = (keys || obj).length;
    for (var index = 0; index < length; index++) {
      var currentKey = keys ? keys[index] : index;
      if (!predicate(obj[currentKey], currentKey, obj)) return false;
    }
    return true;
  };

  // Determine if at least one element in the object matches a truth test.
  // Aliased as `any`.
  // 判断obj是否至少有一个满足predicate，若存在一个满足则返回true
  _.some = _.any = function(obj, predicate, context) {
    predicate = cb(predicate, context);
    var keys = !isArrayLike(obj) && _.keys(obj),
        length = (keys || obj).length;
    for (var index = 0; index < length; index++) {
      var currentKey = keys ? keys[index] : index;
      if (predicate(obj[currentKey], currentKey, obj)) return true;
    }
    return false;
  };

  // Determine if the array or object contains a given item (using `===`).
  // Aliased as `includes` and `include`.
  // 判断obj是否包含item，如果包含则返回true
  _.contains = _.includes = _.include = function(obj, item, fromIndex, guard) {
    // 如果不是数组，则获取该对象的全部键值
    if (!isArrayLike(obj)) obj = _.values(obj);
    // 默认从0开始寻找，可以指定fromIndex
    if (typeof fromIndex != 'number' || guard) fromIndex = 0;
    return _.indexOf(obj, item, fromIndex) >= 0;
  };
 
  // Invoke a method (with arguments) on every item in a collection.
  // 在obj上的每个元素执行method方法(传递方法名)，例如：
  // _.invoke([[5, 1, 7], [3, 2, 1]], 'sort')
  // _.invoke([[1, 2, 3], [3, 4, 5]], 'join', '#')
  _.invoke = restArgs(function(obj, method, args) {
    var isFunc = _.isFunction(method);
    // 遍历该obj => value
    return _.map(obj, function(value) {
      // 如果method是函数，则直接使用该函数
      // TODO value[method]是什么?
      // 如果method不是函数，则取value[method]
      var func = isFunc ? method : value[method];
      // 如果func为null，则返回null，否则调用该函数返回函数运行结果
      return func == null ? func : func.apply(value, args);
    });
  });

  // Convenience version of a common use case of `map`: fetching a property.
  // var stooges = [{name: 'moe', age: 40}, {name: 'larry', age: 50}, {name: 'curly', age: 60}];
  // _.pluck(stooges, 'name');
  // => ["moe", "larry", "curly"]
  _.pluck = function(obj, key) {
    // _.property(key)是返回获取该key键名对应键值的函数，用该函数去对obj做map
    return _.map(obj, _.property(key));
  };

  // Convenience version of a common use case of `filter`: selecting only objects
  // containing specific `key:value` pairs.
  // 返回包含attrs的obj中的对象
  // filter只返回符合条件的
  _.where = function(obj, attrs) {
    return _.filter(obj, _.matcher(attrs));
  };

  // Convenience version of a common use case of `find`: getting the first object
  // containing specific `key:value` pairs.
  // find找到包含attrs的第一个对象
  _.findWhere = function(obj, attrs) {
    return _.find(obj, _.matcher(attrs));
  };

  // Return the maximum element (or element-based computation).
  // 联系max的用法，例如：
  // var students = [{name: 'Mike', age: 21}, {name: 'John', age: 22}, {name: 'Judy', age:20}];
  // _.max(students, function(student) { return student.age })    =>    {name: 'John', age: 22}
  _.max = function(obj, iteratee, context) {
    // 无穷小
    var result = -Infinity, lastComputed = -Infinity,
        value, computed;
    // 如果没有传递iteratee，则按值进行比较
    // 这里有两种情况
    // 1. 没有传递iteratee并且obj不为空，按值进行找最大值
    // 2. iteratee为数字并且obj[0]类型不为object？ TODO
    if (iteratee == null || (typeof iteratee == 'number' && typeof obj[0] != 'object') && obj != null) {
      // 如果obj是数组不变，如果是对象则取其对应键名数组
      obj = isArrayLike(obj) ? obj : _.values(obj);
      // 找最大值
      for (var i = 0, length = obj.length; i < length; i++) {
        value = obj[i];
        if (value != null && value > result) {
          result = value;
        }
      }
    } else {
      // 传入了iteratee，则对obj每个元素进行iteratee找最大值
      iteratee = cb(iteratee, context);
      _.each(obj, function(v, index, list) {
        computed = iteratee(v, index, list);
        if (computed > lastComputed || computed === -Infinity && result === -Infinity) {
          result = v;
          lastComputed = computed;
        }
      });
    }
    return result;
  };

  // Return the minimum element (or element-based computation).
  // 同上
  _.min = function(obj, iteratee, context) {
    var result = Infinity, lastComputed = Infinity,
        value, computed;
    if (iteratee == null || (typeof iteratee == 'number' && typeof obj[0] != 'object') && obj != null) {
      obj = isArrayLike(obj) ? obj : _.values(obj);
      for (var i = 0, length = obj.length; i < length; i++) {
        value = obj[i];
        if (value != null && value < result) {
          result = value;
        }
      }
    } else {
      iteratee = cb(iteratee, context);
      _.each(obj, function(v, index, list) {
        computed = iteratee(v, index, list);
        if (computed < lastComputed || computed === Infinity && result === Infinity) {
          result = v;
          lastComputed = computed;
        }
      });
    }
    return result;
  };

  // Shuffle a collection.
  // 返回一个随机乱序的obj副本
  // 例如： _.shuffle([1, 2, 3, 4, 5, 6]);
  // => [4, 1, 6, 3, 5, 2]
  // 额，前面一直没去注意
  // Infinity也是js的一个词法
  // 表示无穷大，不能被重写，-Infinity表示无穷小
  _.shuffle = function(obj) {
    return _.sample(obj, Infinity);
  };

  // Sample **n** random values from a collection using the modern version of the
  // [Fisher-Yates shuffle](http://en.wikipedia.org/wiki/Fisher–Yates_shuffle).
  // If **n** is not specified, returns a single random element.
  // The internal `guard` argument allows it to work with `map`.
  // 从obj中随机去n个出来形成一个副本，例如：
  // _.sample([1, 2, 3, 4, 5, 6], 3) => [1, 6, 2]
  // 如果没有给定n，则n为1
  _.sample = function(obj, n, guard) {
    // 随机返回一个结果
    if (n == null || guard) {
      if (!isArrayLike(obj)) obj = _.values(obj);
      return obj[_.random(obj.length - 1)];
    }
    // 副本sample，如果obj为数组则克隆这个数组，否则取obj的键值数组
    var sample = isArrayLike(obj) ? _.clone(obj) : _.values(obj);
    var length = getLength(sample);
    n = Math.max(Math.min(n, length), 0);
    var last = length - 1;
    // 随机取数放入
    for (var index = 0; index < n; index++) {
      // 直接在sample上操作，不开辟新空间
      // 随机取一个下标，值与下标为index的值交换
      var rand = _.random(index, last);
      var temp = sample[index];
      sample[index] = sample[rand];
      sample[rand] = temp;
    }
    // 最后取sample的前n个形成一个新的数组返回即可
    return sample.slice(0, n);
  };

  // Sort the object's values by a criterion produced by an iteratee.
  // _.sortBy([1, 2, 3, 4, 5, 6], function(num) {return Math.sin(num);})
  // => [5, 4, 6, 3, 1, 2]
  // var stooges = [{name: 'moe', age: 28}, {name: 'larry', age: 39}, {name: 'mike', age: 43}];
  // _.sortBy(stooges, 'name');
  // => [{name: 'mike', age: 41}, {name: 'larry', age: 39}, {name: 'moe', age: 28}]
  _.sortBy = function(obj, iteratee, context) {
    var index = 0;
    iteratee = cb(iteratee, context);
    // 第一步map操作
    // 对obj中的每一个元素都使用给定的函数去处理，返回一个新的obj
    // 这一步目的是新建一个包含多个对象的数组，对象的value存放原对应元素的值，index为索引，criteria为sortBy的iteratee处理的权值
    // 第二步sort操作
    // 这一步是进行排序，要知道js数组具有sort方法可以排序，但由于给定的数组是对象数组，需要给定排序方式
    // a>b返回true，a<b返回false表示要降序排序
    // a===b时的处理使权值相同两数索引大的排左边
    // 第三步是萃取
    // 使用pluck使用value取出结果
    return _.pluck(_.map(obj, function(value, key, list) {
      return {
        value: value,
        index: index++,
        criteria: iteratee(value, key, list)
      };
    }).sort(function(left, right) {
      var a = left.criteria;
      var b = right.criteria;
      if (a !== b) {
        if (a > b || a === void 0) return 1;
        if (a < b || b === void 0) return -1;
      }
      return left.index - right.index;
    }), 'value');
  };

  /** 2016年8月1日 */
  // An internal function used for aggregate "group by" operations.
  var group = function(behavior, partition) {
    return function(obj, iteratee, context) {
      // partition在数组一分为二时有效，这时候result取[[], []]
      // 然后用iteratee方法得出key值
      // 然后behavior方法会把value放入result[key]中，key处理使为0或1
      // 通过each遍历对result填充后最后返回result即可
      // 如果partition无效，见groupBy注释，其实道理一样的。
      var result = partition ? [[], []] : {};
      iteratee = cb(iteratee, context);
      _.each(obj, function(value, index) {
        var key = iteratee(value, index, obj);
        behavior(result, value, key);
      });
      return result;
    };
  };

  // Groups the object's values by a criterion. Pass either a string attribute
  // to group by, or a function that returns the criterion.
  // 示例：
  // _.groupBy(['one', 'two', 'three'], 'length');
  // => {3: ["one", "two"], 5: ["three"]}
  // _.groupBy([1.3, 2.1, 2.4], function(num) { return Math.floor(num); });
  // => {1: [1.3], 2: [2.1, 2.4]}
  _.groupBy = group(function(result, value, key) {
    // 这个function直接传入group的behavior，我们直接看group去
    // 返回一个函数接受obj, iteratee, context三个参数
    // 对obj做遍历，并使用iteratee求出key值，然后再把该key和obj元素的value与index一同传入behavior
    // behavior即此处的function，如果key已存在，则push进去，否则新建一个key属性，放进去
    // 就这样实现分组
    if (_.has(result, key)) result[key].push(value); else result[key] = [value];
  });

  // Indexes the object's values by a criterion, similar to `groupBy`, but for
  // when you know that your index values will be unique.
  // 这个类似上面的groupBy了，只不过key对应的值唯一，如果再有会进行覆盖
  _.indexBy = group(function(result, value, key) {
    result[key] = value;
  });

  // Counts instances of an object that group by a certain criterion. Pass
  // either a string attribute to count by, or a function that returns the
  // criterion.
  // 还是和上面一样，统计个数而已
  // 例如：
  // _.countBy([1, 2, 3, 4, 5],  function(num) { return num%2 == 0 ? 'even' : 'odd'; });
  // => {odd: 3, even: 2}
  _.countBy = group(function(result, value, key) {
    if (_.has(result, key)) result[key]++; else result[key] = 1;
  });

  var reStrSymbol = /[^\ud800-\udfff]|[\ud800-\udbff][\udc00-\udfff]|[\ud800-\udfff]/g;
  // Safely create a real, live array from anything iterable.
  _.toArray = function(obj) {
    if (!obj) return [];
    // 已经是数组了，为什么还要调用slice.call？
    if (_.isArray(obj)) return slice.call(obj);
    // 是字符串，用上面这个正则匹配处理
    if (_.isString(obj)) {
      // Keep surrogate pair characters together
      // 不了解上面的正则，但是意思就是把字符串分割成一个字符一个字符的
      return obj.match(reStrSymbol);
    }
    // 伪数组处理
    if (isArrayLike(obj)) return _.map(obj, _.identity);
    // 是对象，返回键值数组
    return _.values(obj);
  };

  // Return the number of elements in an object.
  // 返回obj长度，数组长度或者对象键名数组长度
  _.size = function(obj) {
    if (obj == null) return 0;
    return isArrayLike(obj) ? obj.length : _.keys(obj).length;
  };

  // Split a collection into two arrays: one whose elements all satisfy the given
  // predicate, and one whose elements all do not satisfy the predicate.
  // 拆分一个数组为两个数组，使第一个数组的元素都满足给定的predicate函数
  _.partition = group(function(result, value, pass) {
    // 根据结果划分为两个数组
    result[pass ? 0 : 1].push(value);
  }, true);

  // Array Functions
  // ---------------

  // Get the first element of an array. Passing **n** will return the first N
  // values in the array. Aliased as `head` and `take`. The **guard** check
  // allows it to work with `_.map`.
  // 返回数组从地一个元素开始的n个元素
  // 如果应用在map中，例如:
  // _.map([[1, 2, 3], [4, 5, 6]] , _.first);
  // => [1, 4]
  // first会接收到三个参数，参考上面map方法，由于传入第三个参数，所以这里达到返回数组第一个的作用。
  _.first = _.head = _.take = function(array, n, guard) {
    if (array == null || array.length < 1) return void 0;
    if (n == null || guard) return array[0];
    return _.initial(array, array.length - n);
  };

  // Returns everything but the last entry of the array. Especially useful on
  // the arguments object. Passing **n** will return all the values in
  // the array, excluding the last N.
  // 返回除数组后面n个元素外的其余全部元素
  // _.initial([5, 4, 3, 2, 1]);
  // => [5, 4, 3, 2]
  _.initial = function(array, n, guard) {
    return slice.call(array, 0, Math.max(0, array.length - (n == null || guard ? 1 : n)));
  };

  // Get the last element of an array. Passing **n** will return the last N
  // values in the array.
  // 返回数组最后面n个元素
  // _.last([5, 4, 3, 2, 1]);
  // => 1
  _.last = function(array, n, guard) {
    if (array == null || array.length < 1) return void 0;
    if (n == null || guard) return array[array.length - 1];
    return _.rest(array, Math.max(0, array.length - n));
  };

  // Returns everything but the first entry of the array. Aliased as `tail` and `drop`.
  // Especially useful on the arguments object. Passing an **n** will return
  // the rest N values in the array.
  // 返回除去前n个元素外的其余全部元素
  _.rest = _.tail = _.drop = function(array, n, guard) {
    return slice.call(array, n == null || guard ? 1 : n);
  };

  // Trim out all falsy values from an array.
  // 返回一个除去boolean值的全部副本
  _.compact = function(array) {
    return _.filter(array, Boolean);
  };

  // Internal implementation of a recursive `flatten` function..
  // 解嵌套
  // 如果给了shallow参数则只减少一维
  var flatten = function(input, shallow, strict, output) {
    output = output || [];
    var idx = output.length;
    for (var i = 0, length = getLength(input); i < length; i++) {
      var value = input[i];
      // 若value为数组，把里面东西去出来赋值给output
      // 否则直接赋值给output
      // isArrayLike的判断可以去掉，保留的原因是因为他用来判断value是否为数组很快，可以迅速筛选掉非数组
      if (isArrayLike(value) && (_.isArray(value) || _.isArguments(value))) {
        // Flatten current level of array or arguments object.
        if (shallow) {
          // 如果给了shallow参数，只进行一次深度遍历
          var j = 0, len = value.length;
          while (j < len) output[idx++] = value[j++];
        } else {
          // 一直遍历下去，如果是元素则按下面赋值，如果是数组则继续遍历
          flatten(value, shallow, strict, output);
          idx = output.length;
        }
      } else if (!strict) {
        output[idx++] = value;
      }
    }
    return output;
  };

  // Flatten out an array, either recursively (by default), or just one level.
  // strict为false
  // _.flatten([1, [2], [3, [[4]]]]);
  // => [1, 2, 3, 4]
  _.flatten = function(array, shallow) {
    return flatten(array, shallow, false);
  };

  // Return a version of the array that does not contain the specified value(s).
  // _.without([1, 2, 1, 0, 3, 1, 4], 0, 1);
  // => [2, 3, 4]
  // 返回删除所有otherArrays值后的array副本
  _.without = restArgs(function(array, otherArrays) {
    return _.difference(array, otherArrays);
  });

  // Produce a duplicate-free version of the array. If the array has already
  // been sorted, you have the option of using a faster algorithm.
  // Aliased as `unique`.
  _.uniq = _.unique = function(array, isSorted, iteratee, context) {
    if (!_.isBoolean(isSorted)) {
      context = iteratee;
      iteratee = isSorted;
      isSorted = false;
    }
    if (iteratee != null) iteratee = cb(iteratee, context);
    var result = [];
    var seen = [];
    for (var i = 0, length = getLength(array); i < length; i++) {
      var value = array[i],
          computed = iteratee ? iteratee(value, i, array) : value;
      if (isSorted) {
        if (!i || seen !== computed) result.push(value);
        seen = computed;
      } else if (iteratee) {
        if (!_.contains(seen, computed)) {
          seen.push(computed);
          result.push(value);
        }
      } else if (!_.contains(result, value)) {
        result.push(value);
      }
    }
    return result;
  };

  // Produce an array that contains the union: each distinct element from all of
  // the passed-in arrays.
  // 返回多个数组的并集
  // _.union([1, 2, 3], [101, 2, 1, 10], [2, 1]);
  // => [1, 2, 3, 101, 10]
  // 这里flatten传入了strict为true并且shallow也为true
  _.union = restArgs(function(arrays) {
    return _.uniq(flatten(arrays, true, true));
  });

  // Produce an array that contains every item shared between all the
  // passed-in arrays.
  _.intersection = function(array) {
    var result = [];
    var argsLength = arguments.length;
    for (var i = 0, length = getLength(array); i < length; i++) {
      var item = array[i];
      if (_.contains(result, item)) continue;
      var j;
      for (j = 1; j < argsLength; j++) {
        if (!_.contains(arguments[j], item)) break;
      }
      if (j === argsLength) result.push(item);
    }
    return result;
  };

  // Take the difference between one array and a number of other arrays.
  // Only the elements present in just the first array will remain.
  // 只对比数组中的第一层
  // _.difference([0, 1, 2, 3, [4]], [0, 1, [4]])
  // => [2, 3, [4]]
  _.difference = restArgs(function(array, rest) {
    // 这里调用flatten方法，shallow和strict都为true
    // [0, 1] => 
    rest = flatten(rest, true, true);
    return _.filter(array, function(value){
      return !_.contains(rest, value);
    });
  });

  // 2016年8月3日
  // Complement of _.zip. Unzip accepts an array of arrays and groups
  // each array's elements on shared indices.
  // _.unzip([['moe', 'larry', 'curly'], [30, 40, 50], [true, false, false]])
  // => ["moe", 30, true], ["larry", 40, false], ["curly", 50, false]
  _.unzip = function(array) {
    // 取array中最长的一个数组
    var length = array && _.max(array, getLength).length || 0;
    var result = Array(length);

    for (var index = 0; index < length; index++) {
      // 根据数组下标萃取
      result[index] = _.pluck(array, index);
    }
    return result;
  };

  // Zip together multiple lists into a single array -- elements that share
  // an index go together.
  // 注意zip和unzip区别
  // _.zip(['moe', 'larry', 'curly'], [30, 40, 50], [true, false, false]);
  // => [["moe", 30, true], ["larry", 40, false], ["curly", 50, false]]
  _.zip = restArgs(_.unzip);

  // Converts lists into objects. Pass either a single array of `[key, value]`
  // pairs, or two parallel arrays of the same length -- one of keys, and one of
  // the corresponding values.
  // 如果传入两个数组，则一个作为键名一个作为简直
  // 一一对应形成一个对象返回
  // 如果只传入一个数组，且数组的元素形如[key, value]形式
  // 则每一个元素第一个作为键名，第二个作为键值
  _.object = function(list, values) {
    var result = {};
    for (var i = 0, length = getLength(list); i < length; i++) {
      if (values) {
        result[list[i]] = values[i];
      } else {
        result[list[i][0]] = list[i][1];
      }
    }
    return result;
  };

  // Generator function to create the findIndex and findLastIndex functions.
  var createPredicateIndexFinder = function(dir) {
    // predicate通过cb统一为一个函数来处理
    // 把value, index, list传入该函数如果返回了true, 则立即返回此时的下标或键值
    // 注意cb在这个地方的处理过程
    return function(array, predicate, context) {
      predicate = cb(predicate, context);
      var length = getLength(array);
      // dir为1表示找数组下标
      // dir为-1表示找对象键名
      var index = dir > 0 ? 0 : length - 1;
      for (; index >= 0 && index < length; index += dir) {
        if (predicate(array[index], index, array)) return index;
      }
      return -1;
    };
  };

  // Returns the first index on an array-like that passes a predicate test.
  _.findIndex = createPredicateIndexFinder(1);
  _.findLastIndex = createPredicateIndexFinder(-1);

  // Use a comparator function to figure out the smallest index at which
  // an object should be inserted so as to maintain order. Uses binary search.
  // 二分查找
  // obj插入到array中且保持array的排序，返回这个obj插入位置
  _.sortedIndex = function(array, obj, iteratee, context) {
    iteratee = cb(iteratee, context, 1);
    var value = iteratee(obj);
    var low = 0, high = getLength(array);
    while (low < high) {
      var mid = Math.floor((low + high) / 2);
      if (iteratee(array[mid]) < value) low = mid + 1; else high = mid;
    }
    return low;
  };

  // Generator function to create the indexOf and lastIndexOf functions.
  var createIndexFinder = function(dir, predicateFind, sortedIndex) {
    return function(array, item, idx) {
      var i = 0, length = getLength(array);
      // 如果指定了开始或者结束位置
      if (typeof idx == 'number') {
        if (dir > 0) {
          i = idx >= 0 ? idx : Math.max(idx + length, i);
        } else {
          length = idx >= 0 ? Math.min(idx + 1, length) : idx + length + 1;
        }
      } else if (sortedIndex && idx && length) {  // 如果idx为true，二分查找确定
        idx = sortedIndex(array, item);
        return array[idx] === item ? idx : -1;
      }
      // 如果item为NaN，只有NaN不严格等于自身
      // 即找array中第一个/最后一个为NaN的位置
      // 利用findIndex/fingLastIndex查找
      if (item !== item) {
        idx = predicateFind(slice.call(array, i, length), _.isNaN);
        return idx >= 0 ? idx + i : -1;
      }
      // 上面行不通，遍历array查找
      for (idx = dir > 0 ? i : length - 1; idx >= 0 && idx < length; idx += dir) {
        if (array[idx] === item) return idx;
      }
      return -1;
    };
  };

  // Return the position of the first occurrence of an item in an array,
  // or -1 if the item is not included in the array.
  // If the array is large and already in sort order, pass `true`
  // for **isSorted** to use binary search.
  _.indexOf = createIndexFinder(1, _.findIndex, _.sortedIndex);
  _.lastIndexOf = createIndexFinder(-1, _.findLastIndex);

  // Generate an integer Array containing an arithmetic progression. A port of
  // the native Python `range()` function. See
  // [the Python documentation](http://docs.python.org/library/functions.html#range).
  // 输出从start到stop间隔step的全部数
  _.range = function(start, stop, step) {
    // 没有指定stop，则0 to start
    if (stop == null) {
      stop = start || 0;
      start = 0;
    }
    // 没有指定step，如果start大于stop取1，反之取-1
    if (!step) {
      step = stop < start ? -1 : 1;
    }
    // 计算应该输出的长度
    var length = Math.max(Math.ceil((stop - start) / step), 0);
    var range = Array(length);
    // 开始产生
    for (var idx = 0; idx < length; idx++, start += step) {
      range[idx] = start;
    }

    return range;
  };

  // Split an **array** into several arrays containing **count** or less elements
  // of initial array.
  // 把array划分为几个数组，每个数组的数量小于等于count(最后一个不足数可以小于count，其他应等于)
  _.chunk = function(array, count) {
    if (count == null || count < 1) return [];

    var result = [];
    var i = 0, length = array.length;
    while (i < length) {
      result.push(slice.call(array, i, i += count));
    }
    return result;
  };

  // 2016年8月4日
  // Function (ahem) Functions
  // ------------------

  // Determines whether to execute a function as a constructor
  // or a normal function with the provided arguments.
  var executeBound = function(sourceFunc, boundFunc, context, callingContext, args) {
    if (!(callingContext instanceof boundFunc)) return sourceFunc.apply(context, args);
    var self = baseCreate(sourceFunc.prototype);
    var result = sourceFunc.apply(self, args);
    if (_.isObject(result)) return result;
    return self;
  };

  // Create a function bound to a given object (assigning `this`, and arguments,
  // optionally). Delegates to **ECMAScript 5**'s native `Function.bind` if
  // available.
  _.bind = restArgs(function(func, context, args) {
    if (!_.isFunction(func)) throw new TypeError('Bind must be called on a function');
    var bound = restArgs(function(callArgs) {
      // 被绑定的函数，绑定后的函数，要绑定的上下文，原函数的上下文，绑定后的函数接受到的传入的参数
      // 实质上就是进去简单的把context绑定到func而已，还有就是把处理下args
      return executeBound(func, bound, context, this, args.concat(callArgs));
    });
    return bound;
  });

  // Partially apply a function by creating a version that has had some of its
  // arguments pre-filled, without changing its dynamic `this` context. _ acts
  // as a placeholder by default, allowing any combination of arguments to be
  // pre-filled. Set `_.partial.placeholder` for a custom placeholder argument.
  // 两种用法：
  // var subtract = (a, b) => b - a;
  // sub5 = _.partial(subtract, 5);    sub5(20);    => 15
  // subFrom20 = _.partial(subtract, _, 20);    subFrom20(5);    => 15
  _.partial = restArgs(function(func, boundArgs) {
    var placeholder = _.partial.placeholder;
    var bound = function() {
      var position = 0, length = boundArgs.length;
      var args = Array(length);
      // arguments是第二次调用的时候的参数，boundArgs是第一次调用的时候的参数
      // 如果绑定的时候是_则从第二次调用的arguments顺序取，否则从第一次调用的boundArgs按位置取
      for (var i = 0; i < length; i++) {
        args[i] = boundArgs[i] === placeholder ? arguments[position++] : boundArgs[i];
      }
      // 把arguments中剩下的参数都push进args
      while (position < arguments.length) args.push(arguments[position++]);
      // func绑定this和args并调用
      return executeBound(func, bound, this, this, args);
    };
    return bound;
  });

  _.partial.placeholder = _;

  // Bind a number of an object's methods to that object. Remaining arguments
  // are the method names to be bound. Useful for ensuring that all callbacks
  // defined on an object belong to it.
  _.bindAll = restArgs(function(obj, keys) {
    keys = flatten(keys, false, false);
    var index = keys.length;
    if (index < 1) throw new Error('bindAll must be passed function names');
    // 把obj绑定到obj[key](一般是方法)上
    while (index--) {
      var key = keys[index];
      obj[key] = _.bind(obj[key], obj);
    }
  });

  // Memoize an expensive function by storing its results.
  // 缓存某函数的计算结果
  // var fibnoacci = _.memoize(function(n){ return n < 2 ? n : fibonacci(n-1) + fibonacci(n-2);})
  // 如果传递hasher参数，则用hasher的返回值作为key存储函数的计算结果
  _.memoize = function(func, hasher) {
    var memoize = function(key) {
      var cache = memoize.cache;
      // 是否传递hasher，如果传递了则调用该hasher调用取参数，否则使用该key
      var address = '' + (hasher ? hasher.apply(this, arguments) : key);
      // 如果缓存中没有计算过address，则计算并添加到缓存中
      if (!_.has(cache, address)) cache[address] = func.apply(this, arguments);
      // 返回缓存
      return cache[address];
    };
    // 清空缓存，返回运算结果
    memoize.cache = {};
    return memoize;
  };

  // Delays a function for the given number of milliseconds, and then calls
  // it with the arguments supplied.
  // 延迟执行函数
  _.delay = restArgs(function(func, wait, args) {
    return setTimeout(function() {
      return func.apply(null, args);
    }, wait);
  });

  // Defers a function, scheduling it to run after the current call stack has
  // cleared.
  // 延迟调用函数，类似与延时0的setTimeout方法
  // 这样做会把该函数放到执行队列末尾，优先保证其他函数的执行，比如让渲染先行
  // 参考http://stackoverflow.com/a/779785/6278006
  _.defer = _.partial(_.delay, _, 1);

  // Returns a function, that, when invoked, will only be triggered at most once
  // during a given window of time. Normally, the throttled function will run
  // as much as it can, without ever going more than once per `wait` duration;
  // but if you'd like to disable the execution on the leading edge, pass
  // `{leading: false}`. To disable execution on the trailing edge, ditto.
  // func周期调用，如果周期内被再次调用会被覆盖，用来控制触发频率高的时间，节流阀
  // 如果想禁用第一次首先执行，传递{leading: false}
  // 如果想禁用最后一次执行，传递{trailling: false}
  // var throttled = _.throttle(updatePosition, 100);
  // $(window).scroll(throttled);
  // 以这个例子为例：
  // 1.1 如果leading不为false，remaining等于wait - now，一般而言是小于0了，立即执行函数一次
  // 1.2 如果leading为false，previous设置为now，则remaining等于wait
  // 1.2.1 如果trailing不为false，在remainning后执行later调用func函数
  // 1.2.2 如果trailing为false，则直接返回result为undefined
  // 2 上述执行完后会设置previos为上一次运行的时间，再次运行时，会检查now与previos之差
  // 2.1 如果差在周期内，则等剩余时间后执行
  // 2.2 如果差已经超出周期，则立即调用执行，之后效果同1.1
  // 3 如果在周期时间内已经调用了并设置了remaining时间后执行函数，此时再次调用函数，直接return result.
  // leading的作用很明显可以看出来，trailing的作用是禁用了setTimeout，结果是只有用户超出周期调用的函数才会被执行
  // 区别在与一个已经执行过一次的函数周期内再次调用，则等这个周期结束后会执行
  // 而设置了trailing在周期结束后不会立即执行，而是等待周期结束后用户调用才执行
  // ** 应用:
  // 默认：调整窗口，第一次应该立即相应，之后每个周期内最多执行一次，周期内点击会产生定时
  // 设置leading为false：同上，第一次不立即响应（会在周期结束后相应），每个周期内最多执行一次，周期内点击会产生定时
  // 设置trailing为false：每个周期内最多执行一次，周期内再次点击不会产生定时，即只在上一次发生周期时间后点击才有效
  _.throttle = function(func, wait, options) {
    var timeout, context, args, result;
    var previous = 0;
    if (!options) options = {};

    var later = function() {
      // 更改previous即上一次执行时间为当前时间
      previous = options.leading === false ? 0 : _.now();
      timeout = null;
      result = func.apply(context, args);
      if (!timeout) context = args = null;
    };

    var throttled = function() {
      var now = _.now();
      // 如果leading为false时禁用第一次首先执行，previous等于now（效果同已经执行过一次，所以第一次被禁用）
      // 这个if语句只在第一次执行该函数的时候有效
      if (!previous && options.leading === false) previous = now;
      var remaining = wait - (now - previous);
      context = this;
      args = arguments;
      // 超时处理和未到时的处理
      if (remaining <= 0 || remaining > wait) {
        // timeout不为null
        if (timeout) {
          clearTimeout(timeout);
          timeout = null;
        }
        previous = now;
        // 立即调用
        result = func.apply(context, args);
        if (!timeout) context = args = null;
      } else if (!timeout && options.trailing !== false) {    // 如果没有禁用最后一次执行
        timeout = setTimeout(later, remaining);               // remaining毫秒后执行later
      }
      // 返回调用的结果
      return result;
    };

    throttled.cancel = function() {
      clearTimeout(timeout);
      previous = 0;
      timeout = context = args = null;
    };

    return throttled;
  };

  // Returns a function, that, as long as it continues to be invoked, will not
  // be triggered. The function will be called after it stops being called for
  // N milliseconds. If `immediate` is passed, trigger the function on the
  // leading edge, instead of the trailing.
  // timeout是用来保证timeout时间内最多只能执行一次
  // 如果immediate为true，周期100:
  // 0 => 立即执行，timeout设置
  // 50 => timeout重新设置，不执行
  // 100 => timeout重新设置，不执行
  // 200 => 立即执行，timeout设置
  // 如果immediate为false，周期100：
  // 0 => 设置timeout，不执行
  // 100 => timeout到时执行
  // 120 => 设置timeout，不执行
  // 150 => 设置timeout，不执行
  // 250 => timeout到时执行
  _.debounce = function(func, wait, immediate) {
    var timeout, result;

    var later = function(context, args) {
      timeout = null;
      if (args) result = func.apply(context, args);
    };

    var debounced = restArgs(function(args) {
      // 再次调用且上次还未执行，则清除上次的timeout
      // 只是timeout事件不再执行，但timeout依旧存在
      if (timeout) clearTimeout(timeout);
      // 如果immediate为true
      if (immediate) {
        // 如果timeout为null，则立即调用函数
        // 如果timeout不为null，则callNow为false，函数不执行
        var callNow = !timeout;
        timeout = setTimeout(later, wait);
        if (callNow) result = func.apply(this, args);
      } else {
        // 延迟later执行，如果这个还没到时间再来一次，则新的会覆盖上一次的
        timeout = _.delay(later, wait, this, args);
      }

      return result;
    });

    debounced.cancel = function() {
      clearTimeout(timeout);
      timeout = null;
    };

    return debounced;
  };

  // Returns the first function passed as an argument to the second,
  // allowing you to adjust arguments, run code before and after, and
  // conditionally execute the original function.
  // 让wrapper先于func执行
  _.wrap = function(func, wrapper) {
    return _.partial(wrapper, func);
  };

  // Returns a negated version of the passed-in predicate.
  // 返回与predicate相反的结果
  _.negate = function(predicate) {
    return function() {
      return !predicate.apply(this, arguments);
    };
  };

  // Returns a function that is the composition of a list of functions, each
  // consuming the return value of the function that follows.
  // 复合函数
  _.compose = function() {
    var args = arguments;
    var start = args.length - 1;
    return function() {
      var i = start;
      // 上一个的执行结果给下一个调用
      var result = args[start].apply(this, arguments);
      while (i--) result = args[i].call(this, result);
      return result;
    };
  };

  // Returns a function that will only be executed on and after the Nth call.
  // 函数只有在第times次调用时才执行
  _.after = function(times, func) {
    return function() {
      if (--times < 1) {
        return func.apply(this, arguments);
      }
    };
  };

  // Returns a function that will only be executed up to (but not including) the Nth call.
  // 这个函数只能被调用times-1次
  _.before = function(times, func) {
    var memo;
    return function() {
      if (--times > 0) {
        memo = func.apply(this, arguments);
      }
      if (times <= 1) func = null;
      return memo;
    };
  };

  // Returns a function that will be executed at most one time, no matter how
  // often you call it. Useful for lazy initialization.
  // 这个函数之被调用一次
  _.once = _.partial(_.before, 2);

  _.restArgs = restArgs;

  // Object Functions
  // ----------------

  // Keys in IE < 9 that won't be iterated by `for key in ...` and thus missed.
  // IE < 9 时，toString是不可枚举的
  // 例如：
  // var obj = {toString: 'test'};
  // for(var k in obj) { alert(k); }
  // Chrome正常但IE8什么都没有
  // hasEnumBug就是来判断有无存在这个bug的
  // 所以下面的代码都是做一个一个FUCK IE的处理
  var hasEnumBug = !{toString: null}.propertyIsEnumerable('toString');
  var nonEnumerableProps = ['valueOf', 'isPrototypeOf', 'toString',
                      'propertyIsEnumerable', 'hasOwnProperty', 'toLocaleString'];

  var collectNonEnumProps = function(obj, keys) {
    var nonEnumIdx = nonEnumerableProps.length;
    var constructor = obj.constructor;
    var proto = _.isFunction(constructor) && constructor.prototype || ObjProto;

    // Constructor is a special case.
    var prop = 'constructor';
    if (_.has(obj, prop) && !_.contains(keys, prop)) keys.push(prop);

    while (nonEnumIdx--) {
      prop = nonEnumerableProps[nonEnumIdx];
      if (prop in obj && obj[prop] !== proto[prop] && !_.contains(keys, prop)) {
        keys.push(prop);
      }
    }
  };

  // Retrieve the names of an object's own properties.
  // Delegates to **ECMAScript 5**'s native `Object.keys`.
  // 获取一个对象的键名数组，只在own上进行
  _.keys = function(obj) {
    if (!_.isObject(obj)) return [];
    if (nativeKeys) return nativeKeys(obj);
    var keys = [];
    for (var key in obj) if (_.has(obj, key)) keys.push(key);
    // Ahem, IE < 9.
    if (hasEnumBug) collectNonEnumProps(obj, keys);
    return keys;
  };

  // Retrieve all the property names of an object.
  // 遍历深入到其原型中去
  _.allKeys = function(obj) {
    if (!_.isObject(obj)) return [];
    var keys = [];
    for (var key in obj) keys.push(key);
    // Ahem, IE < 9.
    if (hasEnumBug) collectNonEnumProps(obj, keys);
    return keys;
  };

  // Retrieve the values of an object's properties.
  // 返回obj的键值到数组
  _.values = function(obj) {
    var keys = _.keys(obj);
    var length = keys.length;
    var values = Array(length);
    for (var i = 0; i < length; i++) {
      values[i] = obj[keys[i]];
    }
    return values;
  };

  // Returns the results of applying the iteratee to each element of the object.
  // In contrast to _.map it returns an object.
  // 类似map，但是是在对象上面进行
  _.mapObject = function(obj, iteratee, context) {
    iteratee = cb(iteratee, context);
    var keys = _.keys(obj),
        length = keys.length,
        results = {};
    // 遍历键名数组
    for (var index = 0; index < length; index++) {
      var currentKey = keys[index];
      results[currentKey] = iteratee(obj[currentKey], currentKey, obj);
    }
    return results;
  };

  // Convert an object into a list of `[key, value]` pairs.
  _.pairs = function(obj) {
    var keys = _.keys(obj);
    var length = keys.length;
    var pairs = Array(length);
    for (var i = 0; i < length; i++) {
      pairs[i] = [keys[i], obj[keys[i]]];
    }
    return pairs;
  };

  // Invert the keys and values of an object. The values must be serializable.
  // 键值键名调换
  _.invert = function(obj) {
    var result = {};
    var keys = _.keys(obj);
    for (var i = 0, length = keys.length; i < length; i++) {
      result[obj[keys[i]]] = keys[i];
    }
    return result;
  };

  // Return a sorted list of the function names available on the object.
  // Aliased as `methods`.
  // 返回一个对象里所有的方法名，数组形式返回
  _.functions = _.methods = function(obj) {
    var names = [];
    // for...in...遍历，判断是不是函数
    for (var key in obj) {
      if (_.isFunction(obj[key])) names.push(key);
    }
    return names.sort();
  };

  // An internal function for creating assigner functions.
  // keysFunc有两种，一种是ownProperty，一种是遍历全部
  // default是对
  var createAssigner = function(keysFunc, defaults) {
    return function(obj) {
      var length = arguments.length;
      // 创建一个新的Object，和参数obj相同
      if (defaults) obj = Object(obj);
      // 如果只有一个参数或者obj为空，则直接返回该对象
      if (length < 2 || obj == null) return obj;
      // 从第二个参数开始，取完全部参数
      for (var index = 1; index < length; index++) {
        var source = arguments[index],
            keys = keysFunc(source),
            l = keys.length;
        // 把source的值拷贝到obj中去
        for (var i = 0; i < l; i++) {
          var key = keys[i];
          // 如果defaults为true，则只对原obj中undefined的值覆盖
          // 否则则全部覆盖
          if (!defaults || obj[key] === void 0) obj[key] = source[key];
        }
      }
      return obj;
    };
  };

  // Extend a given object with all the properties in passed-in object(s).
  // 把其他对象的全部属性都复制到第一个对象中去
  _.extend = createAssigner(_.allKeys);

  // Assigns a given object with all the own properties in the passed-in object(s).
  // (https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Object/assign)
  // 只复制oweProperty
  _.extendOwn = _.assign = createAssigner(_.keys);

  // Returns the first key on an object that passes a predicate test.
  // 类似数组findIndex只不过这个是针对对象=.=
  // 返回obj中符合predicate的第一个key
  _.findKey = function(obj, predicate, context) {
    predicate = cb(predicate, context);
    var keys = _.keys(obj), key;
    for (var i = 0, length = keys.length; i < length; i++) {
      key = keys[i];
      if (predicate(obj[key], key, obj)) return key;
    }
  };

  // Internal pick helper function to determine if `obj` has key `key`.
  var keyInObj = function(value, key, obj) {
    return key in obj;
  };

  // Return a copy of the object only containing the whitelisted properties.
  // 返回一个obj副本，只挑选keys数组指定的属性，或者是一个判断函数来指定
  _.pick = restArgs(function(obj, keys) {
    var result = {}, iteratee = keys[0];
    if (obj == null) return result;
    if (_.isFunction(iteratee)) {
      // 第一个参数为函数的话，第二个参数为要绑定的上下文
      if (keys.length > 1) iteratee = optimizeCb(iteratee, keys[1]);
      keys = _.allKeys(obj);
    } else {
      iteratee = keyInObj;
      keys = flatten(keys, false, false);
      obj = Object(obj);
    }
    for (var i = 0, length = keys.length; i < length; i++) {
      var key = keys[i];
      var value = obj[key];
      if (iteratee(value, key, obj)) result[key] = value;
    }
    return result;
  });

  // Return a copy of the object without the blacklisted properties.
  // 类似上面，但是是过滤掉keys或者通过一个函数来指定
  _.omit = restArgs(function(obj, keys) {
    var iteratee = keys[0], context;
    if (_.isFunction(iteratee)) {
      // 判断函数取反
      iteratee = _.negate(iteratee);
      if (keys.length > 1) context = keys[1];
    } else {
      keys = _.map(flatten(keys, false, false), String);
      iteratee = function(value, key) {
        return !_.contains(keys, key);
      };
    }
    return _.pick(obj, iteratee, context);
  });

  // Fill in a given object with default properties.
  // 和_.extend相比多了个default = true参数
  // 用第二个对象的值匹配填充第一个对象undefined的值
  _.defaults = createAssigner(_.allKeys, true);

  // Creates an object that inherits from the given prototype object.
  // If additional properties are provided then they will be added to the
  // created object.
  _.create = function(prototype, props) {
    // 创建一个原型为prototype的空对象
    var result = baseCreate(prototype);
    // 把props复制替换到result中
    if (props) _.extendOwn(result, props);
    return result;
  };

  // Create a (shallow-cloned) duplicate of an object.
  // 浅复制
  _.clone = function(obj) {
    if (!_.isObject(obj)) return obj;
    // 如果是数组，调用slice方法即可返回一个新的数组
    // 如果是对象，执行extend方法拷贝obj
    return _.isArray(obj) ? obj.slice() : _.extend({}, obj);
  };

  // Invokes interceptor with the obj, and then returns obj.
  // The primary purpose of this method is to "tap into" a method chain, in
  // order to perform operations on intermediate results within the chain.
  // 链式调用interceptor方法，比如在链式调用某一环节console.log。
  _.tap = function(obj, interceptor) {
    interceptor(obj);
    return obj;
  };

  // Returns whether an object has a given set of `key:value` pairs.
  // 判断一个对象是否包含 'key: value'
  _.isMatch = function(object, attrs) {
    // 先取出attrs的键名，得到键名数组keys，然后获取keys的长度
    var keys = _.keys(attrs), length = keys.length;
    // 如果object为空，若length为0,即attrs没东西，则返回true
    // 否则返回false
    if (object == null) return !length;
    var obj = Object(object);
    for (var i = 0; i < length; i++) {
      // 依次取出键值数组的键名和键值来判断object是否都含有
      var key = keys[i];
      // 如果有一个键名obj没有则返回false
      if (attrs[key] !== obj[key] || !(key in obj)) return false;
    }
    return true;
  };


  // Internal recursive comparison function for `isEqual`.
  var eq, deepEq;
  eq = function(a, b, aStack, bStack) {
    // Identical objects are equal. `0 === -0`, but they aren't identical.
    // See the [Harmony `egal` proposal](http://wiki.ecmascript.org/doku.php?id=harmony:egal).
    if (a === b) return a !== 0 || 1 / a === 1 / b;
    // A strict comparison is necessary because `null == undefined`.
    if (a == null || b == null) return a === b;
    // `NaN`s are equivalent, but non-reflexive.
    if (a !== a) return b !== b;
    // Exhaust primitive checks
    var type = typeof a;
    if (type !== 'function' && type !== 'object' && typeof b != 'object') return false;
    return deepEq(a, b, aStack, bStack);
  };

  // Internal recursive comparison function for `isEqual`.
  deepEq = function(a, b, aStack, bStack) {
    // Unwrap any wrapped objects.
    if (a instanceof _) a = a._wrapped;
    if (b instanceof _) b = b._wrapped;
    // Compare `[[Class]]` names.
    var className = toString.call(a);
    if (className !== toString.call(b)) return false;
    switch (className) {
      // Strings, numbers, regular expressions, dates, and booleans are compared by value.
      case '[object RegExp]':
      // RegExps are coerced to strings for comparison (Note: '' + /a/i === '/a/i')
      case '[object String]':
        // Primitives and their corresponding object wrappers are equivalent; thus, `"5"` is
        // equivalent to `new String("5")`.
        return '' + a === '' + b;
      case '[object Number]':
        // `NaN`s are equivalent, but non-reflexive.
        // Object(NaN) is equivalent to NaN.
        if (+a !== +a) return +b !== +b;
        // An `egal` comparison is performed for other numeric values.
        return +a === 0 ? 1 / +a === 1 / b : +a === +b;
      case '[object Date]':
      case '[object Boolean]':
        // Coerce dates and booleans to numeric primitive values. Dates are compared by their
        // millisecond representations. Note that invalid dates with millisecond representations
        // of `NaN` are not equivalent.
        return +a === +b;
      case '[object Symbol]':
        return SymbolProto.valueOf.call(a) === SymbolProto.valueOf.call(b);
    }

    var areArrays = className === '[object Array]';
    if (!areArrays) {
      if (typeof a != 'object' || typeof b != 'object') return false;

      // Objects with different constructors are not equivalent, but `Object`s or `Array`s
      // from different frames are.
      var aCtor = a.constructor, bCtor = b.constructor;
      if (aCtor !== bCtor && !(_.isFunction(aCtor) && aCtor instanceof aCtor &&
                               _.isFunction(bCtor) && bCtor instanceof bCtor)
                          && ('constructor' in a && 'constructor' in b)) {
        return false;
      }
    }
    // Assume equality for cyclic structures. The algorithm for detecting cyclic
    // structures is adapted from ES 5.1 section 15.12.3, abstract operation `JO`.

    // Initializing stack of traversed objects.
    // It's done here since we only need them for objects and arrays comparison.
    aStack = aStack || [];
    bStack = bStack || [];
    var length = aStack.length;
    while (length--) {
      // Linear search. Performance is inversely proportional to the number of
      // unique nested structures.
      if (aStack[length] === a) return bStack[length] === b;
    }

    // Add the first object to the stack of traversed objects.
    aStack.push(a);
    bStack.push(b);

    // Recursively compare objects and arrays.
    if (areArrays) {
      // Compare array lengths to determine if a deep comparison is necessary.
      length = a.length;
      if (length !== b.length) return false;
      // Deep compare the contents, ignoring non-numeric properties.
      while (length--) {
        if (!eq(a[length], b[length], aStack, bStack)) return false;
      }
    } else {
      // Deep compare objects.
      var keys = _.keys(a), key;
      length = keys.length;
      // Ensure that both objects contain the same number of properties before comparing deep equality.
      if (_.keys(b).length !== length) return false;
      while (length--) {
        // Deep compare each member
        key = keys[length];
        if (!(_.has(b, key) && eq(a[key], b[key], aStack, bStack))) return false;
      }
    }
    // Remove the first object from the stack of traversed objects.
    aStack.pop();
    bStack.pop();
    return true;
  };

  // Perform a deep comparison to check if two objects are equal.
  _.isEqual = function(a, b) {
    return eq(a, b);
  };

  // Is a given array, string, or object empty?
  // An "empty" object has no enumerable own-properties.
  _.isEmpty = function(obj) {
    if (obj == null) return true;
    if (isArrayLike(obj) && (_.isArray(obj) || _.isString(obj) || _.isArguments(obj))) return obj.length === 0;
    return _.keys(obj).length === 0;
  };

  // Is a given value a DOM element?
  _.isElement = function(obj) {
    return !!(obj && obj.nodeType === 1);
  };

  // Is a given value an array?
  // Delegates to ECMA5's native Array.isArray
  // 判断obj是不是数组，如果有原生方法则调用原生方法
  // 伪数组arguments => [object Arguments]
  // 数组            => [object Array]
  _.isArray = nativeIsArray || function(obj) {
    return toString.call(obj) === '[object Array]';
  };

  // Is a given variable an object?
  _.isObject = function(obj) {
    var type = typeof obj;
    return type === 'function' || type === 'object' && !!obj;
  };

  // Add some isType methods: isArguments, isFunction, isString, isNumber, isDate, isRegExp, isError, isMap, isWeakMap, isSet, isWeakSet.
  // 通过数组形式赋值函数
  _.each(['Arguments', 'Function', 'String', 'Number', 'Date', 'RegExp', 'Error', 'Symbol', 'Map', 'WeakMap', 'Set', 'WeakSet'], function(name) {
    _['is' + name] = function(obj) {
      return toString.call(obj) === '[object ' + name + ']';
    };
  });

  // Define a fallback version of the method in browsers (ahem, IE < 9), where
  // there isn't any inspectable "Arguments" type.
  // 又是IE...
  if (!_.isArguments(arguments)) {
    _.isArguments = function(obj) {
      return _.has(obj, 'callee');
    };
  }

  // Optimize `isFunction` if appropriate. Work around some typeof bugs in old v8,
  // IE 11 (#1621), Safari 8 (#1929), and PhantomJS (#2236).
  // 判断obj是否为函数
  // 在一些浏览器有兼容问题
  var nodelist = root.document && root.document.childNodes;
  if (typeof /./ != 'function' && typeof Int8Array != 'object' && typeof nodelist != 'function') {
    _.isFunction = function(obj) {
      return typeof obj == 'function' || false;
    };
  }

  // Is a given object a finite number?
  _.isFinite = function(obj) {
    return !_.isSymbol(obj) && isFinite(obj) && !isNaN(parseFloat(obj));
  };

  // Is the given value `NaN`?
  _.isNaN = function(obj) {
    return _.isNumber(obj) && isNaN(obj);
  };

  // Is a given value a boolean?
  // 注意最后一个判断
  // TODO: 什么时候会需要最后一个判断？
  _.isBoolean = function(obj) {
    return obj === true || obj === false || toString.call(obj) === '[object Boolean]';
  };

  // Is a given value equal to null?
  _.isNull = function(obj) {
    return obj === null;
  };

  // Is a given variable undefined?
  _.isUndefined = function(obj) {
    return obj === void 0;
  };

  // Shortcut function for checking if an object has a given property directly
  // on itself (in other words, not on a prototype).
  // 判断obj是否有属性key
  _.has = function(obj, key) {
    return obj != null && hasOwnProperty.call(obj, key);
  };

  // Utility Functions
  // -----------------

  // Run Underscore.js in *noConflict* mode, returning the `_` variable to its
  // previous owner. Returns a reference to the Underscore object.
  // 解决命名冲突
  // _.noConflict可以得到Underscore对象，而_赋值为原有的
  _.noConflict = function() {
    root._ = previousUnderscore;
    return this;
  };

  // Keep the identity function around for default iteratees.
  // 返回value本身
  _.identity = function(value) {
    return value;
  };

  // Predicate-generating functions. Often useful outside of Underscore.
  // 将一个值变为返回该值的函数
  _.constant = function(value) {
    return function() {
      return value;
    };
  };

  _.noop = function(){};

  _.property = property;

  // Generates a function for a given object that returns a given property.
  // 产生一个函数，这个函数原型为obj
  _.propertyOf = function(obj) {
    return obj == null ? function(){} : function(key) {
      return obj[key];
    };
  };

  // Returns a predicate for checking whether an object has a given set of
  // `key:value` pairs.
  _.matcher = _.matches = function(attrs) {
    // 相当与新建一个含有attrs的对象
    attrs = _.extendOwn({}, attrs);
    return function(obj) {
      // 判断obj是否包含attrs，是的话返回true
      return _.isMatch(obj, attrs);
    };
  };

  // Run a function **n** times.
  // 执行一个函数n次并将n次执行的结果放入数组返回
  _.times = function(n, iteratee, context) {
    var accum = Array(Math.max(0, n));
    iteratee = optimizeCb(iteratee, context, 1);
    for (var i = 0; i < n; i++) accum[i] = iteratee(i);
    return accum;
  };

  // Return a random integer between min and max (inclusive).
  // 返回一个介于min到max的随机数，如果只给了一个参数，则返回0到这个参数的随机数
  _.random = function(min, max) {
    if (max == null) {
      max = min;
      min = 0;
    }
    // min + 随机0-1的数 * 最大数和最小数之差加1
    return min + Math.floor(Math.random() * (max - min + 1));
  };

  // A (possibly faster) way to get the current timestamp as an integer.
  // 返回当前时间，尝试先使用原生方法
  _.now = Date.now || function() {
    return new Date().getTime();
  };

  // List of HTML entities for escaping.
  // 转义list和反转义
  var escapeMap = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#x27;',
    '`': '&#x60;'
  };
  var unescapeMap = _.invert(escapeMap);

  // Functions for escaping and unescaping strings to/from HTML interpolation.
  // HTML字符转义和反转义
  var createEscaper = function(map) {
    var escaper = function(match) {
      return map[match];
    };
    // Regexes for identifying a key that needs to be escaped.
    var source = '(?:' + _.keys(map).join('|') + ')';
    var testRegexp = RegExp(source);
    var replaceRegexp = RegExp(source, 'g');
    return function(string) {
      string = string == null ? '' : '' + string;
      return testRegexp.test(string) ? string.replace(replaceRegexp, escaper) : string;
    };
  };
  _.escape = createEscaper(escapeMap);
  _.unescape = createEscaper(unescapeMap);

  // If the value of the named `property` is a function then invoke it with the
  // `object` as context; otherwise, return it.
  // 在object上获取prop，如果是函数则执行并返回结果，fallback是指定默认值
  _.result = function(object, prop, fallback) {
    var value = object == null ? void 0 : object[prop];
    if (value === void 0) {
      value = fallback;
    }
    return _.isFunction(value) ? value.call(object) : value;
  };

  // Generate a unique integer id (unique within the entire client session).
  // Useful for temporary DOM ids.
  // 生成一个唯一ID
  var idCounter = 0;
  _.uniqueId = function(prefix) {
    var id = ++idCounter + '';
    return prefix ? prefix + id : id;
  };

  // By default, Underscore uses ERB-style template delimiters, change the
  // following template settings to use alternative delimiters.
  // 支持三种模板匹配
  _.templateSettings = {
    evaluate: /<%([\s\S]+?)%>/g,
    interpolate: /<%=([\s\S]+?)%>/g,
    escape: /<%-([\s\S]+?)%>/g
  };

  // When customizing `templateSettings`, if you don't want to define an
  // interpolation, evaluation or escaping regex, we need one that is
  // guaranteed not to match.
  var noMatch = /(.)^/;

  // Certain characters need to be escaped so that they can be put into a
  // string literal.
  // TODO: 前两个不一样？
  var escapes = {
    "'": "'",
    '\\': '\\',
    '\r': 'r',
    '\n': 'n',
    '\u2028': 'u2028',
    '\u2029': 'u2029'
  };

  var escapeRegExp = /\\|'|\r|\n|\u2028|\u2029/g;

  var escapeChar = function(match) {
    return '\\' + escapes[match];
  };

  // JavaScript micro-templating, similar to John Resig's implementation.
  // Underscore templating handles arbitrary delimiters, preserves whitespace,
  // and correctly escapes quotes within interpolated code.
  // NB: `oldSettings` only exists for backwards compatibility.
  _.template = function(text, settings, oldSettings) {
    if (!settings && oldSettings) settings = oldSettings;
    settings = _.defaults({}, settings, _.templateSettings);

    // Combine delimiters into one regular expression via alternation.
    var matcher = RegExp([
      (settings.escape || noMatch).source,
      (settings.interpolate || noMatch).source,
      (settings.evaluate || noMatch).source
    ].join('|') + '|$', 'g');

    // Compile the template source, escaping string literals appropriately.
    var index = 0;
    var source = "__p+='";
    text.replace(matcher, function(match, escape, interpolate, evaluate, offset) {
      source += text.slice(index, offset).replace(escapeRegExp, escapeChar);
      index = offset + match.length;

      if (escape) {
        source += "'+\n((__t=(" + escape + "))==null?'':_.escape(__t))+\n'";
      } else if (interpolate) {
        source += "'+\n((__t=(" + interpolate + "))==null?'':__t)+\n'";
      } else if (evaluate) {
        source += "';\n" + evaluate + "\n__p+='";
      }

      // Adobe VMs need the match returned to produce the correct offset.
      return match;
    });
    source += "';\n";

    // If a variable is not specified, place data values in local scope.
    if (!settings.variable) source = 'with(obj||{}){\n' + source + '}\n';

    source = "var __t,__p='',__j=Array.prototype.join," +
      "print=function(){__p+=__j.call(arguments,'');};\n" +
      source + 'return __p;\n';

    var render;
    try {
      render = new Function(settings.variable || 'obj', '_', source);
    } catch (e) {
      e.source = source;
      throw e;
    }

    var template = function(data) {
      return render.call(this, data, _);
    };

    // Provide the compiled source as a convenience for precompilation.
    var argument = settings.variable || 'obj';
    template.source = 'function(' + argument + '){\n' + source + '}';

    return template;
  };

  // Add a "chain" function. Start chaining a wrapped Underscore object.
  // 将obj封装成一个Underscore实例，直接在obj上调用Underscore的方法
  _.chain = function(obj) {
    var instance = _(obj);
    instance._chain = true;
    return instance;
  };

  // OOP
  // ---------------
  // If Underscore is called as a function, it returns a wrapped object that
  // can be used OO-style. This wrapper holds altered versions of all the
  // underscore functions. Wrapped objects may be chained.

  // Helper function to continue chaining intermediate results.
  var chainResult = function(instance, obj) {
    return instance._chain ? _(obj).chain() : obj;
  };

  // Add your own custom functions to the Underscore object.
  _.mixin = function(obj) {
    // 遍历obj上的所有方法
    _.each(_.functions(obj), function(name) {
      var func = _[name] = obj[name];
      // 修改原型和函数参数
      _.prototype[name] = function() {
        // this._wrapped即对象自身
        var args = [this._wrapped];
        push.apply(args, arguments);
        return chainResult(this, func.apply(_, args));
      };
    });
    return _;
  };

  // Add all of the Underscore functions to the wrapper object.
  
  // 把非自创的方法添加到Underscore对象上面而已
  // Add all mutator Array functions to the wrapper.
  _.each(['pop', 'push', 'reverse', 'shift', 'sort', 'splice', 'unshift'], function(name) {
    var method = ArrayProto[name];
    _.prototype[name] = function() {
      var obj = this._wrapped;
      method.apply(obj, arguments);
      // IE的锅
      if ((name === 'shift' || name === 'splice') && obj.length === 0) delete obj[0];
      return chainResult(this, obj);
    };
  });

  // Add all accessor Array functions to the wrapper.
  _.each(['concat', 'join', 'slice'], function(name) {
    var method = ArrayProto[name];
    _.prototype[name] = function() {
      return chainResult(this, method.apply(this._wrapped, arguments));
    };
  });

  // Extracts the result from a wrapped and chained object.
  // 从链式调用中返回当前运行结果
  _.prototype.value = function() {
    return this._wrapped;
  };

  // Provide unwrapping proxy for some methods used in engine operations
  // such as arithmetic and JSON stringification.
  _.prototype.valueOf = _.prototype.toJSON = _.prototype.value;

  _.prototype.toString = function() {
    return String(this._wrapped);
  };

  // AMD registration happens at the end for compatibility with AMD loaders
  // that may not enforce next-turn semantics on modules. Even though general
  // practice for AMD registration is to be anonymous, underscore registers
  // as a named module because, like jQuery, it is a base library that is
  // popular enough to be bundled in a third party lib, but not be part of
  // an AMD load request. Those cases could generate an error when an
  // anonymous define() is called outside of a loader request.
  if (typeof define == 'function' && define.amd) {
    define('underscore', [], function() {
      return _;
    });
  }
}());

// TODO:
// - AMD CMD
// - 模板处理
// - 深度复制
// - flatten

