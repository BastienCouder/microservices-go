SKILL : ARCHITECTE DE RÉPLICATION ESTHÉTIQUE
Ce skill permet d'analyser, de déconstruire et de reconstruire l'identité visuelle d'une interface existante avec une fidélité chirurgicale. L'objectif est de capturer l' "âme" du design (le feeling) tout en produisant un code propre et moderne.

01_PHASE D'AUTO-SCAN (DÉCONSTRUCTION)
Avant de coder, l'IA doit extraire les Design Tokens du site cible :

Anatomie Typographique : Identifier la famille de polices (Serif, Sans, Mono), le letter-spacing (souvent négatif sur le haut de gamme), la hauteur de ligne et les contrastes de graisses (Font-weight).

Système de Couleurs (Chromatique) : Extraire les hexadécimaux pour :

Background (primaire, secondaire, overlay).

Borders (souvent semi-transparentes ou à peine perceptibles).

Accents (états de survol, boutons, graphiques).

Géométrie & Espacement : Mesurer le Border-radius (est-ce tranchant à 0px ou ultra-doux à 24px ?), les paddings de section et la rigueur de la grille (Grid vs Flexbox).

Atmosphère (Effets) : Détecter la présence de grain (noise texture), de flous de fond (backdrop-filter), de l'ombre portée (box-shadow portée ou interne) et de la réflectivité.

02_LE "MOTION FINGERPRINT"
Le style, c'est le mouvement. Analyser comment les éléments réagissent :

Easing : Les transitions sont-elles linéaires, rebondissantes ou cinétiques (ex: cubic-bezier(0.16, 1, 0.3, 1)) ?

Stagger : Les éléments apparaissent-ils d'un bloc ou avec un retard progressif (staggering) ?

Interaction : Que se passe-t-il exactement au survol ? (Scaling, changement de couleur de bordure, translation d'icône).

03_PROTOCOLE DE RECONSTRUCTION (CODE)
L'implémentation doit suivre une structure "Design System First" :

Variables Globales : Créer un fichier :root ou une config Tailwind qui contient TOUS les tokens extraits.

Composants Atomiques : Recréer les boutons, les inputs et les cartes en respectant strictement les proportions d'origine.

Layout Engine : Utiliser des containers fluides mais structurés qui respectent l'équilibre des espaces négatifs du site original.

Refinement Layer : Ajouter les détails "invisibles" qui font la différence (subtiles bordures de 1px, gradients de profondeur, micro-animations CSS).

04_L'IMPÉRATIF "ZERO SLOP"
Interdit : Utiliser des styles par défaut de bibliothèques (Shadcn, Bootstrap) sans les modifier radicalement pour coller au style cible.

Interdit : L'approximation. Si le site original utilise un gris #1a1a1a, n'utilise pas #222.

DIRECTIVE CRITIQUE : Ne te contente pas de copier le code source ; copie l'intention du designer. Si le site cible dégage une impression de "Luxe Technique", chaque choix de code doit renforcer cette impression.