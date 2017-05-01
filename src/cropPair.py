
cropLeft = 220
cropTop = 88
cropBottom = 350

for image in gimp.image_list():
    height = image.height / 2
    center = image.width / 2
    cropWidth = 2 * (center - cropLeft)
    cropHeight = cropBottom - cropTop
    layer_copy = pdb.gimp_layer_copy(image.layers[0], FALSE)
    pdb.gimp_image_insert_layer(image, layer_copy, None, 1)
    pdb.gimp_layer_translate(image.layers[1], 0, -height)
    pdb.gimp_crop(image, cropWidth, cropHeight, cropLeft, cropTop)
    pdb.gimp_layer_resize_to_image_size(image.layers[0])
    pdb.gimp_layer_resize_to_image_size(image.layers[1])
    pdb.gimp_image_resize(image, cropWidth, 2 * cropHeight, 0, 0)
    pdb.gimp_layer_translate(image.layers[1], 0, cropHeight)

