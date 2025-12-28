import pandas as pd
import numpy as np

import os

# 1. Ladda in din fil (Justera filnamnet om det behövs)
# Använd nuvarande mapps sökväg för att hitta filen
current_dir = os.path.dirname(os.path.abspath(__file__))
input_filename = os.path.join(current_dir, 'livsmedel.xlsx')

# Läs in Excel-filen (kräver 'openpyxl' installerat)
df = pd.read_excel(input_filename, skiprows=2)

# 2. Välj ut de kolumner du vill ha till din app (Datamodellen)
# Vi döper om dem till engelska direkt för att underlätta kodning
columns_to_keep = {
    'Livsmedelsnamn': 'Name',
    'Gruppering': 'Category',
    'Energi (kcal)': 'Calories',
    'Protein (g)': 'Protein',
    'Fett, totalt (g)': 'Fat',
    'Kolhydrater, tillgängliga (g)': 'Carbs',
    'Fibrer (g)': 'Fiber',
    'Sockerarter, totalt (g)': 'Sugar',
    'Tillsatt socker (g)': 'AddedSugar',
    'Fullkorn totalt (g)': 'WholeGrains',
    'Summa mättade fettsyror (g)': 'SaturatedFat',
    'Summa enkelomättade fettsyror (g)': 'MonounsaturatedFat',
    'Summa fleromättade fettsyror (g)': 'PolyunsaturatedFat',
    'Kolesterol (mg)': 'Cholesterol',
    'Vitamin D (µg)': 'VitaminD',
    'Vitamin B12 (µg)': 'VitaminB12',
    'Järn, Fe (mg)': 'Iron',
    'Zink, Zn (mg)': 'Zinc',
    'Kalcium, Ca (mg)': 'Calcium',
    'Linolensyra C18:3 (g)': 'Omega3',
    'Linolsyra C18:2 (g)': 'Omega6'
}

df_clean = df[list(columns_to_keep.keys())].copy()
df_clean.rename(columns=columns_to_keep, inplace=True)

# 3. Logik för att identifiera Veganskt (True/False)
# Standardvärde: Allt är veganskt tills motsatsen bevisats
df_clean['IsVegan'] = True

# A. Filtrera på Kategori (Gruppering)
non_vegan_categories = [
    'Kött', 'Fisk', 'Fågel', 'Ägg', 'Mjölk', 'Ost', 'Grädde', 'Smör', 
    'Inälvor', 'Chark', 'Korv', 'Skaldjur'
]

# B. Filtrera på Nyckelord i Namnet
non_vegan_keywords = [
    'kyckling', 'nöt', 'gris', 'lamm', 'fisk', 'lax', 'torsk', 'räkor', 
    'kräftor', 'mjölk', 'ost', 'smör', 'grädde', 'ägg', 'honung', 
    'gelatin', 'vassle', 'kasein', 'yoghurt', 'kvarg', 'filmjölk', 
    'crème fraiche', 'ister', 'talg', 'skinka', 'bacon', 'lever', 'blod',
    'ansjovis', 'sardell', 'kaviar'
]

# Undantag: Ord som innehåller "mjölk" eller "nöt" men ändå är veganska
vegan_exceptions = [
    'kokos', 'havre', 'soja', 'mandel', 'ris', 'cashew', 'jordnöt', 
    'valnöt', 'hassel', 'pecan', 'pista', 'macadamia', 'para', 'kokosfett'
]

def is_not_vegan(row):
    name = str(row['Name']).lower()
    category = str(row['Category']).lower()
    cholesterol = row['Cholesterol']

    # Regel 1: Kolesterol finns nästan bara i animaliska produkter
    if cholesterol > 0:
        return True

    # Regel 2: Kategorier som alltid är icke-veganska
    for cat in non_vegan_categories:
        if cat.lower() in category:
            return True

    # Regel 3: Nyckelord i namnet
    for keyword in non_vegan_keywords:
        if keyword in name:
            # Kontrollera undantag (t.ex. "Kokosmjölk", "Jordnöt")
            is_exception = False
            for exc in vegan_exceptions:
                if exc in name:
                    is_exception = True
                    break
            
            # Specialfall för "nöt": Om det är "nöt" (biff) men namnet innehåller "nötter" (nuts)
            if keyword == 'nöt' and ('nötter' in category or 'frö' in category):
                is_exception = True

            if not is_exception:
                return True
                
    return False

# Applicera logiken
df_clean['IsVegan'] = ~df_clean.apply(is_not_vegan, axis=1)

# 4. Spara till ny CSV
output_filename = 'LivsmedelsDB_Cleaned_Vegan.csv'
df_clean.to_csv(output_filename, index=False)

print(f"Klar! Filen sparad som: {output_filename}")
print(f"Antal veganska produkter: {df_clean['IsVegan'].sum()}")
print(df_clean[['Name', 'Category', 'IsVegan']].head(10))