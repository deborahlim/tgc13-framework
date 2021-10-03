const e = require('express');
const express = require('express');
const router = express.Router();
const { createProductForm, bootstrapField } = require('../forms')

// import in the Product model, Category model and the Tag model from models/index.js
const { Product, Category, Tag } = require('../models');

async function getProductById(productId) {
    let product = await Product.where({
        'id': productId
    }).fetch({
        'require': true
    })

    return product;
}

router.get('/', async function(req,res){
    // eqv. to "select * from products"
    // analogous to: db.collection('products').find({})
    let products = await Product.collection().fetch({
        withRelated:['category', 'tags'] // <-- indicate that we want to load in the category information for each product
    });
    console.log(products.toJSON())
    res.render('products/index',{
        'products': products.toJSON()
    })
})

router.get('/create', async function(req,res){
    // retrieve an array of all available categories
    const allCategories = await Category.fetchAll().map(function(category){
        return [ category.get('id'), category.get('name')]
    })

    // retrieve an array of all the tags
    const allTags = await (await Tag.fetchAll()).map(function(tag){
        return [ tag.get('id'), tag.get('name')]
    })
   
    // create an instance of the form
    const productForm = createProductForm(allCategories, allTags);
    res.render('products/create', {
        'form': productForm.toHTML(bootstrapField)
    })
})

router.post('/create', async function(req,res){

    const productForm = createProductForm();
    // first arg of handle is the request
    // second arg is the setting objects
    productForm.handle(req, {
        // the form parameter is the processed form
        // from caolan-forms
        "success": async function(form){
            // form is submitted successfully with no issue
            // so we can create a new product

            // 1. create an instance of the Product model
            // the Product model ==> a table (in this care, the products table)
            // one instance of the Product model==> a row in the products table
            let newProduct = new Product(); 
            newProduct.set('name', form.data.name);
            newProduct.set('cost', form.data.cost);
            newProduct.set('description', form.data.description)
            newProduct.set('category_id', form.data.category_id)
            // check if the user select any tags
        
            // save the new row to the databse
            await newProduct.save();

            // can only save the relationship after the product is created
            if (form.data.tags) {  
                // example of form.data.tags is '1,2' where 1 and 2 is the id of the tag
                await newProduct.tags().attach(form.data.tags.split(','))
            }
            res.redirect('/products')
        },
        "empty": function(req) {
            res.send("None of the fields are filled in")
        },
        "error": function(form){
            res.render('products/create',{
                'form': form.toHTML(bootstrapField)
            })
        }
    })
})

router.get('/:product_id/update', async function(req,res){
    // retrieve an array of all available categories
    const allCategories = await Category.fetchAll().map(function(category){
        return [ category.get('id'), category.get('name')]
    })

    // get all the existing tags as an array
    const allTags = await (await Tag.fetchAll()).map(function(tag){
        return [ tag.get('id'), tag.get('name')]
    })

    // fetch the details of the product that we want to edit
    let productId = req.params.product_id;

    // fetch the product details using the bookshelf orm
    // use the Product model's where function
    // first arg - an object of settings
    // analgous to db.collection('products').find({'_id':SOMEID})
    const product = await Product.where({
        'id': productId
    }).fetch({
        'require': true,
        'withRelated':['tags']
    });
    // let product = await getProductById(req.params.product_id);

    // create the product form
    let productForm = createProductForm(allCategories, allTags);
    // retrieve the value of the name column from the product
    productForm.fields.name.value = product.get('name');
    productForm.fields.cost.value = product.get('cost');
    productForm.fields.description.value = product.get('description');
    productForm.fields.category_id.value = product.get('category_id');

    // fetch all the related tags of the product
    let selectedTags = await product.related('tags').pluck('id');
    console.log(selectedTags);
    productForm.fields.tags.value = selectedTags;

    res.render('products/update',{
        'form': productForm.toHTML(bootstrapField),
        'product': product.toJSON()
    })
})

router.post('/:product_id/update', async function(req,res){

    const product = await Product.where({
        'id': req.params.product_id
    }).fetch({
        'require': true,
        'withRelated':['tags']
    });
    // console.log(product);
    // process the form
    const productForm = createProductForm();
    productForm.handle(req, {
        'success': async function(form) {
            // form.data MUST HAVE EXACTLY THE SAME KEYS
            // AS THE COLUMNS IN THE PRODUCTS TABLE
            // with the exception of id'
            console.log(form.data);
            let {tags, ...productData} = form.data; // <-- extract out the tags key into the tags variable
                                                    // and place the other remaining keys into an object named productData
                                                    // for more info, consutl JavaScript Object Destructuring
            // i.e, short form for:
            // let tags = form.data.tags;
            // let productData = {}
            // productData.name = form.data.name
            // productData.cost = form.data.cost
            // productData.description = form.data.description
            // productData.category_id = form.data.category_id
            product.set(productData);
            await product.save();
            // i.e
            // product.set("name", form.data.name);
            // product.set("cost", form.data.cost);
            // product.set('description', form.data.description');
            // product.set('category_id', form.data.category_id)

            // update the relationship
            // currently selected tags
            let tagIds = tags.split(',')
         
            // get all the tags that are selected first
            let existingTagIds = await product.related('tags').pluck("id");
            // remove all the tags that are not selected any more
            let toRemove = existingTagIds.filter(function(id){
                return tagIds.includes(id) === false
            })
            
            await product.tags().detach(toRemove);

            // add in all the tags that are selected
            await product.tags().attach(tagIds);      
            res.redirect('/products');
        }
    })
})

router.get('/:product_id/delete', async function(req,res){
   getProductById(req.params.product_id)

    res.render('products/delete', {
        'product': product.toJSON()
    })
})

router.post('/:product_id/delete', async function(req,res){
    const product = await Product.where({
        'id': req.params.product_id
    }).fetch({
        'required': true
    })

    // to delete a row from the table
    // call the destroy function on an instance of the model
    await product.destroy();
    res.redirect('/products')
})

module.exports = router;