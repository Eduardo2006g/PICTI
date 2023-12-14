#Importa as bibliotecas
from tensorflow import keras
from tensorflow.keras import layers
from tensorflow.keras.utils import image_dataset_from_directory
import numpy as np

#Data argumentation é uma tecnica usada para aumenta a qualidade dos dados
data_augmentation = keras.Sequential([
    layers.RandomFlip("horizontal"), 
    layers.RandomRotation(0.1), 
    layers.RandomZoom(0.2)])

#Cria um conjunto de dados de imagens a partir de um diretório especificado
def make_subset(subset="training", directory="kaggle"):
    return image_dataset_from_directory(directory,
                                        image_size=(180, 180),
                                        validation_split=0.25,
                                        subset=subset,
                                        seed=42,
                                        batch_size=32)

#Conjunto de treinamento e validação    
train_dataset = make_subset("training")
validation_dataset = make_subset("validation")


def fineTuningLayers(x):
    x = layers.BatchNormalization()(x)
    x = layers.GlobalMaxPooling2D()(x)
    x = layers.Dropout(0.5)(x)
    return x

#calcula o f1 score macro
def f1_score_macro(y_true, y_pred):
    
    y_true = np.eye(num_labels)[y_true]
    y_pred = np.eye(num_labels)[np.argmax(y_pred, axis=1)]

    # define a precisão e o recall
    precision = np.sum(y_true * y_pred, axis=0) / (np.sum(y_pred, axis=0) + 1e-9)
    recall = np.sum(y_true * y_pred, axis=0) / (np.sum(y_true, axis=0) + 1e-9)

    #calcula o f1
    f1 = 2 * precision * recall / (precision + recall + 1e-9)

    f1_macro = np.mean(f1)

    return f1_macro

def assessArchitecture(architecture, preprocess_input, checkpoint="architecture.dbg", debug=False):
    num_labels = len(train_dataset.class_names)
    
    conv_base = architecture(weights="imagenet", include_top=False)
    conv_base.trainable = False

    inputs = keras.Input(shape=(train_dataset.element_spec[0].shape[1], 
                                train_dataset.element_spec[0].shape[2], 
                                train_dataset.element_spec[0].shape[3]))
    x = data_augmentation(inputs)
    if preprocess_input:
        x = preprocess_input(x)
    x = conv_base(x)

    x = fineTuningLayers(x)
    outputs = layers.Dense(num_labels, activation='softmax')(x)
    model = keras.Model(inputs, outputs)

    model.compile(loss="sparse_categorical_crossentropy", optimizer="rmsprop", metrics=["accuracy"])
    callbacks = [keras.callbacks.ModelCheckpoint(filepath=checkpoint, 
                                                 save_best_only=True, 
                                                 monitor="val_loss"), 
                 keras.callbacks.EarlyStopping(monitor="val_loss", 
                                               patience=5) ]
    epochs = 1 if debug else 50
    history = model.fit(train_dataset, epochs=epochs, validation_data=validation_dataset, callbacks=callbacks)
    model = keras.models.load_model(checkpoint)

    
    y_true = np.concatenate([y for x, y in validation_dataset], axis=0)
    y_pred = model.predict(validation_dataset)
    f1_macro = f1_score_macro(y_true, y_pred)

    return model.evaluate(validation_dataset), history, f1_macro


model_evaluation, training_history, f1_macro = assessArchitecture(keras.applications.MobileNetV2, keras.applications.mobilenet_v2.preprocess_input)
print("Model Evaluation:", model_evaluation)
print("Training History:", training_history.history)
print("F1 Score Macro:", f1_macro)
