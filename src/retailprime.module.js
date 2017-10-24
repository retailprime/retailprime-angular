(function () {
    angular.module('retailprimeStore', ['ngResource', 'ngStorage'])
    .service('$rest', ['$http', '$q', '$localStorage', function ($http, $q, $localStorage) {

        var baseURL = 'https://api.retailpri.me/';

        var routes = {
          auth: {
            default: 'auth/',
            register: 'register/',
            defaultMethod: 'POST'
          },
          customers : {
              default: 'customers/',
              current: 'current/',
              password: 'current/password/'
          },
          categories: 'categories/',
          products: 'products/',
          orders: {
              default: 'orders/',
              validate: 'validate/'
          },
          locations: 'locations/',
          collections: 'collections/'
        };

        function getHeaders() {
              var headers = {
                  Brand: $localStorage.retailprimeStore.key,
                  token: $localStorage.retailprimeStore.user ? $localStorage.retailprimeStore.user.token : null;
              };
              return headers;
        }

        function call(r, options) {

            var sp = r.split('.');
            var route = routes[sp[0]];
            var actualRoute = route;
            if ((typeof route) != 'string') {
                actualRoute = route['default'] + (sp[1] && route[sp[1]] ? route[sp[1]] : '');
            }

            var headers = getHeaders();

            var request = $http({
                method: ((options && options.method) ? options.method : ((typeof route) != 'string' && route.defaultMethod) ? route.defaultMethod : 'GET'),
                url: baseURL + actualRoute + ((options && options.path) ? options.path + '' : '') + ((options && options.query) ? '?' + options.query : ''),
                headers: headers,
                data: ((options && options.data) ? options.data : null)
            });

            return (request.then(success, fail));
        }

        function fail(response) {
            return ($q.reject(response.data));
        }

        function success(response) {
            return (response.data);
        }

        return {
            call: call,
            routes: routes,
            url: baseURL,
            headers: getHeaders
        };
    }])
    .factory('rpStore', ['$localStorage', '$rest', '$scope', function($localStorage, $rest, $scope) {

        var categories = [];
        var products = [];
        var countries = [];
        var Cart = $localStorage.retailprimeCart || {
            Products: [],
            notes: '',
            Coupon: null
        };
        var Customer = $localStorage.retailprimeCustomer || {
            ShippingAddress: {},
            Address: {},
            sameShipping: true
        };

        $scope.$watch(function () { return $localStorage.retailprimeCart; },function(newVal, oldVal){
            Cart = $localStorage.retailprimeCart || {
                Products: [],
                notes: '',
                Coupon: null
            };
        });

        $scope.$watch(function () { return $localStorage.retailprimeCustomer; },function(newVal, oldVal){
            Customer = $localStorage.retailprimeCustomer || {
                ShippingAddress: {},
                Address: {},
                sameShipping: true
            };
        });

        function getCountries(callback){
            $rest.call("locations").then(function(data) {
               countries = data.data;
               return callback ? callback(data.data) || null;
            }, function(err) { });
        }

        function getCategories(callback){
            $rest.call('categories').then(function(data){
                categories = data.data;
                return callback ? callback(data.data) || null;
            });
        }

        function init(key){
            $localStorage.retailprimeStore = { key: key };
            getCountries();
            getCategories();
        }

        function getProducts(categorySlug, options, callback){

            options = options || {};

            var offset = options.offset || 0;
            var limit = options.limit || 10;

            $rest.call("products", {
                path: categorySlug + "/category/",
                query: "&offset=" + offset + "&limit=10"
            }).then(function(data) {

                data.data.forEach(function(product){
                    if(product.isSale){
                        if(product.isPercentage){
                            product.salePrice = product.price - (product.price * (product.saleValue / 100));
                        }
                    }else{
                        product.salePrice = null;
                    }
                });

                if(options.fresh){
                    products = data.data;
                }else{
                    products = products.concat(data.data);
                }

                return callback ? callback(data.data) || null;

            });

        }

        function getProduct(slug, options, callback){

            options = options || {};

            $rest.call("products", {
                path: slug + "/product/"
            }).then(function(data) {
                callback(data.data);
            }, function(err){
                callback(null);
            });

        }

        function setUpcPricing(product, upc){
            if(product.Sale){
                if(product.Sale.isPercentage){
                    upc.salePrice = upc.price - (upc.price * (product.Sale.value / 100));
                }
            }else{
                upc.salePrice = null;
            }

            return upc;
        }

        function getUpc(product, options){

            if(options.upc){
                for(var i = 0; i < product.ProductUpcs.length; i ++){
                    if(product.ProductUpcsp[i].upc === upc){
                        return setUpcPricing(product, product.ProductUpcsp[i]);
                    }
                }
            }else if(options.attributes){
                for(var i = 0; i < product.ProductUpcs.length; i ++){

                    var upc = product.ProductUpcs[i];

                    for(var j = 0; j < upc.Attributes.length; j ++){

                        var approved = 0;

                        for(var attr in options.attributes){
                            if(attr === upc.Attributes[j].name && options.attributes[attr] === upc.Attributes[j].ProductAttribute.value){
                                approved ++;
                            }
                        }

                        if(approved === upc.Attributes.length){
                            return setUpcPricing(product, upc);
                        }

                    }

                }
            }

            return null;
        }

        function addToCart(product, upc, quantity){

            Cart.Products.push({
                ProductId: p.id,
                ProductUpcId: upc.id,
                name: product.name,
                thumbnail: product.thumbnail,
                Attributes: upc.Attributes,
                quantity: quantity || 1,
                price: upc.salePrice || upc.price,
                total: this.price * this.quantity
            });

            $localStorage.retailprimeCart = Cart;

        }

        function removeFromCart(item){

            for (var i = 0; i < Cart.Products.length; i ++){
    			if (Cart.Products.ProductId === item.ProductId && Cart.Products.ProductUpcId === item.ProductUpcId){
    				Cart.Products.splice (i, 1);
                    break;
    			}
    		}

            $localStorage.retailprimeCart = Cart;

        }

        function clearCart(){
            Cart.Products = [];
            Cart.notes = '';

            $localStorage.retailprimeCart = Cart;
        }

        function getOrderDetails(){
            var OrderDetails = [];
            Cart.Products.forEach(function(product){
                OrderDetails.push({
                    ProductUpcId: product.ProductUpcId,
                    ProductId: product.ProductId,
                    price: product.price,
                    quantity: product.quantity,
                    total: product.total
                });
            });
            return OrderDetails;
        }

        function productErrors(err){
            var string = "";
            Cart.Products.forEach(function(p){
                err.data.forEach(function(d){
                    if(d.id == p.ProductUpcId){
                        if(d.stock == 0){
                            string = string + p.name + " is sold out.\n\n"
                        }else{
                            string = string + p.name + " is not available in quantity of " + p.quantity + ".\n\n"
                        }
                    }
                });
            });
            return string;
        }

        function validateCart(callback){

            $rest.call("orders.validate", {
                data: { OrderDetails: getOrderDetails() },
                method: "POST"
            }).then(function(data) {
               callback(null);
            }, function(err) {
                if(err.data && err.data.length){
                    callback(productErrors(err));
                }else{
                    callback("You have placed an invalid order.");
                }
            });
        }

        function checkout(options, callback){
            $rest.call("orders", {
              data: {
                  notes: Cart.notes,
                  OrderDetails: getOrderDetails(),

              },
              method: "POST"
            }).then(function(data) {

               clearCart();
               callback(data.data);

            }, function(err) {
                if(err.data && err.data.length && err.code == 409){
                    callback(productErrors(err));
                }else{
                    alert("You have placed an invalid order.");
                }
            });
        }

        return {
            init: init,
            categories: categories,
            products: products,
            Customer: Customer,
            Cart: Cart,
            getCategories: getCategories,
            getProducts: getProducts,
            getProduct: getProduct,
            getUpc: getUpc,
            addToCart: addToCart,
            removeFromCart: removeFromCart,
            validateCart: validateCart,
            placeOrder: placeOrder
        };

    }]);
})();
