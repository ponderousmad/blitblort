
>>> image = gimp.image_list()[0]
>>> height = image.height / 2
>>> layer_copy = pdb.gimp_layer_copy(image.layers[0], FALSE)
>>> pdb.gimp_image_insert_layer(image, layer_copy, None, 1)
>>> pdb.gimp_layer_translate(image.layers[1], 0, -height)
>>> pdb.gimp_crop(image, image.width, height, 0, 0)
>>> 