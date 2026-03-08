import { createClient } from '@supabase/supabase-js'
import { Html5Qrcode } from 'html5-qrcode'
import './style.css'

// Initialiser Supabase
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY
const supabase = createClient(supabaseUrl, supabaseAnonKey)

// État de l'application
let currentUser = null
let currentFamilies = []
let activeFamilyId = null
let html5QrCode = null
let currentAuthMode = 'login' // 'login' ou 'signup'

// Éléments DOM Auth
const authSection = document.getElementById('auth-section')
const mainSection = document.getElementById('main-section')
const authForm = document.getElementById('auth-form')
const emailInput = document.getElementById('email')
const passwordInput = document.getElementById('password')
const authError = document.getElementById('auth-error')
const authTitle = document.getElementById('auth-title')
const authSubtitle = document.getElementById('auth-subtitle')
const authSubmitBtn = document.getElementById('auth-submit-btn')
const authToggleBtn = document.getElementById('auth-toggle-btn')
const logoutBtn = document.getElementById('logout-btn')

// Éléments DOM Vues et Navigation
const viewList = document.getElementById('view-list')
const viewShopping = document.getElementById('view-shopping')
const viewProfile = document.getElementById('view-profile')

const navList = document.getElementById('nav-list')
const navShopping = document.getElementById('nav-shopping')
const navProfile = document.getElementById('nav-profile')

const views = [
  { view: viewList, nav: navList },
  { view: viewShopping, nav: navShopping },
  { view: viewProfile, nav: navProfile }
]

// Éléments Liste de Courses (Vue 1)
const familySelect = document.getElementById('family-select')
const addItemForm = document.getElementById('add-item-form')
const newItemInput = document.getElementById('new-item-input')
const newItemQuantity = document.getElementById('new-item-quantity')
const shoppingList = document.getElementById('shopping-list')
const itemTemplate = document.getElementById('item-template')
const listCount = document.getElementById('list-count')
const itemSuggestions = document.getElementById('item-suggestions')
const templateSelect = document.getElementById('template-select')
const applyTemplateBtn = document.getElementById('apply-template-btn')
const saveTemplateBtn = document.getElementById('save-template-btn')

// Éléments Scanner
const scanBtn = document.getElementById('scan-btn')
const scannerContainer = document.getElementById('scanner-container')
const closeScannerBtn = document.getElementById('close-scanner-btn')
const scannerStatus = document.getElementById('scanner-status')

const qrConfig = { fps: 10, qrbox: { width: 250, height: 150 } }

// Éléments Mode Courses (Vue 2)
const shoppingModeList = document.getElementById('shopping-mode-list')
const shoppingItemTemplate = document.getElementById('shopping-item-template')
const shoppingProgressText = document.getElementById('shopping-progress-text')
const shoppingCountText = document.getElementById('shopping-count-text')
const shoppingProgressBar = document.getElementById('shopping-progress-bar')
const clearCompletedBtn = document.getElementById('clear-completed-btn')

// Éléments Profil & Famille (Vue 3)
const profileEmail = document.getElementById('profile-email')
const profileRole = document.getElementById('profile-role')
const profileFamilyName = document.getElementById('profile-family-name')
const familyMemberCount = document.getElementById('family-member-count')
const ownerActions = document.getElementById('owner-actions')
const inviteForm = document.getElementById('invite-form')
const inviteEmail = document.getElementById('invite-email')
const inviteMsg = document.getElementById('invite-msg')
const membersList = document.getElementById('members-list')
const createFamilyForm = document.getElementById('create-family-form')
const newFamilyName = document.getElementById('new-family-name')
const createFamilyMsg = document.getElementById('create-family-msg')


// --- Initialisation ---

async function init() {
  const { data: { session } } = await supabase.auth.getSession()

  supabase.auth.onAuthStateChange((_event, session) => {
    handleAuthStateChange(session)
  })

  handleAuthStateChange(session)
  checkAuthErrors()
  setupEventListeners()
}

/**
 * Vérifie si des erreurs d'authentification sont présentes dans le fragment URL (#error=...)
 * Cela arrive lors d'une redirection après un lien de confirmation expiré ou invalide.
 */
function checkAuthErrors() {
  const hash = window.location.hash
  if (hash && hash.includes('error=')) {
    // Transformer le fragment en paramètres lisibles
    const params = new URLSearchParams(hash.substring(1)) // Retirer le '#'
    const errorMsg = params.get('error_description') || params.get('error')

    if (errorMsg) {
      authError.textContent = decodeURIComponent(errorMsg).replace(/\+/g, ' ')
      authError.classList.remove('hidden')
      // Nettoyer l'URL pour éviter de ré-afficher l'erreur au rafraîchissement
      window.history.replaceState(null, null, window.location.pathname)
    }
  }
}

// --- Navigation entre les vues ---
function switchView(targetViewId) {
  views.forEach(({ view, nav }) => {
    if (view.id === targetViewId) {
      view.classList.remove('hidden')
      view.classList.add('flex')
      nav.classList.add('text-primary')
      nav.classList.remove('text-slate-400', 'dark:text-slate-600')
      // Fill the icon
      nav.querySelector('span').classList.add('fill-current')
    } else {
      view.classList.add('hidden')
      view.classList.remove('flex')
      nav.classList.remove('text-primary')
      nav.classList.add('text-slate-400', 'dark:text-slate-600')
      nav.querySelector('span').classList.remove('fill-current')
    }
  })
}


// --- Authentification ---

function handleAuthStateChange(session) {
  currentUser = session?.user || null

  if (currentUser) {
    authSection.classList.add('hidden')
    mainSection.classList.remove('hidden')
    profileEmail.textContent = currentUser.email
    switchView('view-list') // Vue par défaut
    loadFamilies()
  } else {
    authSection.classList.remove('hidden')
    mainSection.classList.add('hidden')
    // S'assurer de cacher les vues principales
    views.forEach(({ view }) => view.classList.add('hidden'))
  }
}

async function handleAuthSubmit(e) {
  e.preventDefault()
  authError.classList.add('hidden')
  authSubmitBtn.disabled = true
  authSubmitBtn.textContent = 'Chargement...'

  const email = emailInput.value
  const password = passwordInput.value

  let result
  if (currentAuthMode === 'login') {
    result = await supabase.auth.signInWithPassword({ email, password })
  } else {
    // On spécifie l'URL de redirection explicitement pour GitHub Pages
    const redirectTo = window.location.origin + window.location.pathname
    result = await supabase.auth.signUp({
      email,
      password,
      options: { redirectTo }
    })
  }

  const { data, error } = result
  authSubmitBtn.disabled = false
  authSubmitBtn.textContent = currentAuthMode === 'login' ? 'Se connecter' : 'S\'inscrire'

  if (error) {
    authError.textContent = error.message
    authError.classList.remove('hidden')
  } else if (currentAuthMode === 'signup' && data.user && !data.session) {
    // Signup réussi mais confirmation email requise
    alert("Compte créé ! Merci de vérifier tes emails pour valider ton compte avant de te connecter.")
    toggleAuthMode() // Revenir en mode login
  }
}

function toggleAuthMode() {
  currentAuthMode = currentAuthMode === 'login' ? 'signup' : 'login'

  if (currentAuthMode === 'signup') {
    authTitle.textContent = "Rejoindre Family Cart"
    authSubtitle.textContent = "Créez votre compte pour commencer"
    authSubmitBtn.textContent = "S'inscrire"
    authToggleBtn.textContent = "Déjà un compte ? Se connecter"
  } else {
    authTitle.textContent = "Family Cart"
    authSubtitle.textContent = "Gérez vos listes ensemble"
    authSubmitBtn.textContent = "Se connecter"
    authToggleBtn.textContent = "Pas de compte ? Créer un compte"
  }

  authError.classList.add('hidden')
}

async function handleLogout() {
  await supabase.auth.signOut()
}

// --- Familles ---

let retries = 0
const maxRetries = 5

async function loadFamilies() {
  const { data, error } = await supabase
    .from('families')
    .select('*, family_members!inner(role)')

  if (error) {
    console.error('Erreur lors du chargement des familles', error)
    shoppingList.innerHTML = '<li class="p-6 text-center text-red-500 font-medium">Erreur de connexion. Réessayez plus tard.</li>'
    return
  }

  currentFamilies = data || []

  if (currentFamilies.length === 0) {
    if (retries < maxRetries) {
      retries++
      console.log(`Aucune famille trouvée, tentative ${retries}/${maxRetries}...`)
      setTimeout(loadFamilies, 2000)
    } else {
      shoppingList.innerHTML = '<li class="p-6 text-center text-slate-400 font-medium italic">Aucune famille trouvée. Créez-en une sur Supabase !</li>'
      shoppingModeList.innerHTML = shoppingList.innerHTML
    }
    return
  }

  familySelect.innerHTML = currentFamilies.map(f =>
    `<option value="${f.id}">${f.name}</option>`
  ).join('')

  if (currentFamilies.length > 0) {
    activeFamilyId = currentFamilies[0].id
    familySelect.value = activeFamilyId
    updateProfileFamilyView()
    loadSuggestions()
    loadTemplates()
  }
}

familySelect.addEventListener('change', (e) => {
  activeFamilyId = e.target.value
  loadShoppingItems()
  updateProfileFamilyView()
  loadTemplates()
})

async function handleCreateFamily(e) {
  e.preventDefault()
  const name = newFamilyName.value.trim()
  if (!name || !currentUser) return

  createFamilyMsg.classList.remove('hidden')
  createFamilyMsg.textContent = 'Création en cours...'
  createFamilyMsg.className = 'text-xs mt-2 text-primary'

  try {
    // Utiliser le RPC pour une création atomique (évite les problèmes de RLS sur le SELECT immédiat)
    const { data: familyId, error } = await supabase.rpc('create_family_with_owner', {
      p_name: name
    })

    if (error) throw error

    createFamilyMsg.textContent = 'Famille créée avec succès !'
    createFamilyMsg.className = 'text-xs mt-2 text-primary font-bold'
    newFamilyName.value = ''

    // 3. Recharger
    loadFamilies()

  } catch (err) {
    console.error('Erreur creation famille', err)
    createFamilyMsg.textContent = 'Erreur lors de la création.'
    createFamilyMsg.className = 'text-xs mt-2 text-red-500'
  }
}


// --- Profil & Gestion Famille (Vue 3) ---

async function updateProfileFamilyView() {
  const activeFamily = currentFamilies.find(f => f.id === activeFamilyId)
  if (!activeFamily) return

  profileFamilyName.textContent = activeFamily.name

  // Vérifier si l'utilisateur est propriétaire
  const myMember = activeFamily.family_members.find(m => true) // role est dans l'objet car join !inner
  const role = myMember ? myMember.role : 'member'

  profileRole.textContent = role === 'owner' ? 'Propriétaire' : 'Membre'

  if (role === 'owner') {
    ownerActions.classList.remove('hidden')
  } else {
    ownerActions.classList.add('hidden')
  }

  inviteMsg.classList.add('hidden')
  await loadFamilyMembers()
}

async function loadFamilyMembers() {
  const { data, error } = await supabase
    .from('family_members')
    .select('user_id, role')
    .eq('family_id', activeFamilyId)

  if (error) {
    console.error('Erreur membres', error)
    return
  }

  familyMemberCount.textContent = `${data.length} Membre${data.length > 1 ? 's' : ''}`

  membersList.innerHTML = data.map(m => {
    const isMe = m.user_id === currentUser.id
    const displayName = isMe ? 'Vous' : 'Membre (' + m.user_id.substring(0, 6) + '...)'
    const avatar = 'https://lh3.googleusercontent.com/aida-public/AB6AXuBlRNUWArXF3aibHSDkdlM4k_NA8ruaGZ5eWwCeYhRdO1Q7hXPN7HSGByo4meLJdtlZ6RMvny5_b-TdJXnuM23F8OEQqqNrphw302FXyo_6e56pRT4Eg4S4JXDDAg7bGDXsy2vjIPz_cNk5sApr_46KZAagDFa4fmI6UEoAb_tx-7DUG2urCUqQG6Zl86t5qFCdeue4fRA8BbeT1v15Tzni8W94EhfUiRyzl4ErlHGxApSdL8x37U1BPRy9hMYYJ3t6b1fLpzxjUS8'

    return `
      <li class="flex items-center gap-4 p-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
        <img alt="Membre" class="w-10 h-10 rounded-full object-cover" src="${isMe ? 'https://lh3.googleusercontent.com/aida-public/AB6AXuDlHpcljmtsN_fW-1my03yBu9MzDR-J8LVpSoBRx9ufvZ8lzJ4Ahru48elZ0-Q85oZStJpxwev2_JmgK5DBgusBdoE_l-mNaWT_vcQGrZeoS6rqIk6UUAbA-ZYa7LjBZZiOke-vLLDg9BG6fdm6xrmooZzgAPegLmQ4iWTSwca3GuwgDQVh1XhHiz9vjPj17zTS5LJnZZqozoyxsYAggz3k54U1szQA6t75w7ptlmDEOqvvtcYQR-QG9YPZk0HS-y1pXm5b-VSPoz4' : avatar}"/>
        <div class="flex-1">
          <p class="font-semibold text-slate-900 dark:text-slate-100">${displayName}</p>
          <p class="text-xs text-slate-500">${m.role === 'owner' ? 'Propriétaire' : 'Membre'}</p>
        </div>
      </li>
    `
  }).join('')
}

inviteForm.addEventListener('submit', async (e) => {
  e.preventDefault()
  const email = inviteEmail.value
  inviteMsg.classList.remove('hidden')
  inviteMsg.textContent = 'Invitation en cours...'
  inviteMsg.className = 'text-xs mt-2 text-primary'

  const { data, error } = await supabase.rpc('add_member_by_email', {
    p_email: email,
    p_family_id: activeFamilyId
  })

  if (error) {
    inviteMsg.textContent = 'Erreur : Utilisateur introuvable ou droits insuffisants.'
    inviteMsg.className = 'text-xs mt-2 text-red-500'
  } else {
    inviteMsg.textContent = 'Membre ajouté avec succès !'
    inviteMsg.className = 'text-xs mt-2 text-primary font-bold'
    inviteEmail.value = ''
    loadFamilyMembers()
  }
})


// --- Liste de courses (Vue 1 & Vue 2) ---

async function loadShoppingItems() {
  if (!activeFamilyId) {
    shoppingList.innerHTML = '<li class="p-6 text-center text-slate-400 font-medium italic">Sélectionnez une famille pour voir les articles.</li>'
    shoppingModeList.innerHTML = shoppingList.innerHTML
    return
  }

  const loadingHtml = '<li class="p-6 text-center text-slate-400 font-medium italic animate-pulse">Chargement des articles...</li>'
  shoppingList.innerHTML = loadingHtml
  shoppingModeList.innerHTML = loadingHtml

  const { data, error } = await supabase
    .from('shopping_items')
    .select('*')
    .eq('family_id', activeFamilyId)
    .eq('is_archived', false)
    .order('created_at', { ascending: true })

  if (error) {
    console.error('Erreur lors du chargement des articles', error)
    return
  }

  renderLists(data)
}

function renderLists(items) {
  shoppingList.innerHTML = ''
  shoppingModeList.innerHTML = ''

  // Calculer le total des quantités
  let totalQty = 0
  let completedQty = 0
  let remainingQty = 0
  let uncompletedRows = 0

  items.forEach(item => {
    const q = parseQuantity(item.quantity)
    const val = q.val !== null ? q.val : 1 // Si pas de nombre, compte comme 1 article
    totalQty += val
    if (item.is_completed) {
      completedQty += val
    } else {
      remainingQty += val
      uncompletedRows++
    }
  })

  // Affichage du compteur : "X articles" (et si quantité > lignes, on précise le total des unités)
  let countText = `${uncompletedRows} article${uncompletedRows > 1 ? 's' : ''}`
  if (remainingQty > uncompletedRows) {
    countText += ` (${remainingQty} au total)`
  }
  listCount.textContent = countText

  const progressPercent = totalQty === 0 ? 0 : Math.round((completedQty / totalQty) * 100)

  shoppingProgressText.textContent = `${progressPercent}%`
  shoppingCountText.textContent = `${completedQty} sur ${totalQty} article${totalQty > 1 ? 's' : ''}`
  shoppingProgressBar.style.width = `${progressPercent}%`


  if (items.length === 0) {
    const emptyHtml = '<li class="p-6 text-center text-slate-400 font-medium italic">Votre liste est vide. Ajoutez quelque chose ! ✨</li>'
    shoppingList.innerHTML = emptyHtml
    shoppingModeList.innerHTML = emptyHtml
    return
  }

  // Rendu Vue 1 (Préparation - On affiche tout)
  items.forEach(item => {
    const clone = itemTemplate.content.cloneNode(true)
    const li = clone.querySelector('li')
    const nameSpan = clone.querySelector('.item-display')
    const deleteBtn = clone.querySelector('.item-delete')
    const iconContainer = clone.querySelector('.item-icon-container')
    const iconSpan = clone.querySelector('.item-icon')

    nameSpan.textContent = item.quantity ? `${item.name} (${item.quantity})` : item.name

    if (item.is_completed) {
      nameSpan.classList.add('line-through', 'text-slate-400', 'dark:text-slate-500')
      iconContainer.classList.remove('border-primary/20', 'bg-background-light')
      iconContainer.classList.add('border-slate-200', 'dark:border-slate-800', 'bg-slate-50', 'dark:bg-slate-900')
      iconSpan.classList.remove('text-primary')
      iconSpan.classList.add('text-slate-400')
    }

    deleteBtn.addEventListener('click', () => deleteItem(item.id))
    shoppingList.appendChild(li)
  })

  // Rendu Vue 2 (Mode Courses - Style avec Checkbox)
  items.forEach(item => {
    const clone = shoppingItemTemplate.content.cloneNode(true)
    const li = clone.querySelector('li')
    const checkbox = clone.querySelector('.item-checkbox')
    const nameSpan = clone.querySelector('.item-display')

    nameSpan.textContent = item.quantity ? `${item.name} (${item.quantity})` : item.name
    checkbox.checked = item.is_completed

    if (item.is_completed) {
      nameSpan.classList.add('line-through', 'text-slate-400', 'dark:text-slate-500')
    }

    checkbox.addEventListener('change', () => toggleItem(item.id, checkbox.checked))

    // Permet de cliquer sur la ligne entière pour cocher
    li.addEventListener('click', (e) => {
      if (e.target !== checkbox) {
        checkbox.checked = !checkbox.checked
        toggleItem(item.id, checkbox.checked)
      }
    })

    shoppingModeList.appendChild(li)
  })
}

addItemForm.addEventListener('submit', async (e) => {
  e.preventDefault()
  const name = newItemInput.value.trim()
  const quantity = newItemQuantity.value.trim()
  if (!name || !activeFamilyId) return

  await insertItem(name, quantity)
  newItemInput.value = ''
  newItemQuantity.value = ''
  loadSuggestions()
})

async function loadSuggestions() {
  if (!activeFamilyId) return

  // On récupère les noms uniques de tous les articles (actifs ou archivés) de cette famille
  const { data, error } = await supabase
    .from('shopping_items')
    .select('name')
    .eq('family_id', activeFamilyId)

  if (error) {
    console.error('Erreur suggestions', error)
    return
  }

  const uniqueNames = Array.from(new Set(data.map(item => item.name)))
  itemSuggestions.innerHTML = uniqueNames.map(name => `<option value="${name}">`).join('')
}

function parseQuantity(q) {
  if (!q) return { val: 1, unit: '', isDefault: true }
  const match = q.match(/^(\d+(?:\.\d+)?)\s*(.*)$/)
  if (match) return { val: parseFloat(match[1]), unit: match[2].trim(), isDefault: false }
  return { val: null, unit: q.trim(), isDefault: false }
}

async function insertItem(name, quantity = '') {
  console.log(`Insertion: ${name}, Qté: ${quantity}`)
  // Vérifier si un article avec le même nom existe déjà (même archivé)
  const { data: existing } = await supabase
    .from('shopping_items')
    .select('*')
    .eq('family_id', activeFamilyId)
    .eq('name', name)
    .maybeSingle()

  if (existing) {
    // Calculer la nouvelle quantité par incrémentation
    const oldQty = parseQuantity(existing.quantity)
    const newAddQty = parseQuantity(quantity)

    let updatedQty = quantity || '1'

    // On n'incrémente que si l'article est actif et NON coché
    if (!existing.is_archived && !existing.is_completed) {
      const oldQty = parseQuantity(existing.quantity)
      const newAddQty = parseQuantity(quantity)

      if (oldQty.val !== null && newAddQty.val !== null) {
        // Si les unités sont compatibles (identiques ou la nouvelle est vide)
        if (oldQty.unit === newAddQty.unit || !newAddQty.unit) {
          const sum = oldQty.val + newAddQty.val
          updatedQty = oldQty.unit ? `${sum} ${oldQty.unit}` : `${sum}`
        }
      }
    }
    // Sinon (si c'était archivé ou déjà coché), on repart de la valeur saisie (ou 1)

    const { error } = await supabase
      .from('shopping_items')
      .update({ is_archived: false, is_completed: false, quantity: updatedQty })
      .eq('id', existing.id)

    if (error) console.error('Erreur reactivation', error)
    else loadShoppingItems()
    return
  }

  const { error } = await supabase
    .from('shopping_items')
    .insert([{ name, quantity, family_id: activeFamilyId, is_archived: false }])

  if (error) {
    console.error('Erreur ajout article', error)
  } else {
    loadShoppingItems()
  }
}

async function toggleItem(id, is_completed) {
  const { error } = await supabase
    .from('shopping_items')
    .update({ is_completed })
    .eq('id', id)

  if (error) {
    console.error('Erreur mise à jour article', error)
  } else {
    loadShoppingItems()
  }
}

async function deleteItem(id) {
  // On n'efface plus de la base, on archive
  const { error } = await supabase
    .from('shopping_items')
    .update({ is_archived: true })
    .eq('id', id)

  if (error) {
    console.error('Erreur archivage article', error)
  } else {
    loadShoppingItems()
    loadSuggestions()
  }
}

async function archiveCompletedItems() {
  if (!activeFamilyId) return

  const { error } = await supabase
    .from('shopping_items')
    .update({ is_archived: true })
    .eq('family_id', activeFamilyId)
    .eq('is_completed', true)

  if (error) {
    console.error('Erreur vidage liste', error)
  } else {
    loadShoppingItems()
    loadSuggestions()
  }
}

// --- Scanner de code-barres (OpenFoodFacts) ---

scanBtn.addEventListener('click', async () => {
  scannerContainer.classList.remove('hidden')

  if (!html5QrCode) {
    html5QrCode = new Html5Qrcode("reader")
  }

  try {
    await html5QrCode.start(
      { facingMode: "environment" },
      qrConfig,
      onScanSuccess,
      onScanFailure
    )
  } catch (err) {
    alert("Erreur d'accès à la caméra. Vérifiez vos permissions.")
    scannerContainer.classList.add('hidden')
  }
})

closeScannerBtn.addEventListener('click', stopScanner)

async function stopScanner() {
  if (html5QrCode && html5QrCode.isScanning) {
    await html5QrCode.stop()
  }
  scannerContainer.classList.add('hidden')
}

function onScanFailure(error) {
  // Silent ignore
}

async function onScanSuccess(decodedText) {
  await stopScanner()
  scannerStatus.textContent = "Recherche du produit..."

  // Show scanner container briefly with new status
  scannerContainer.classList.remove('hidden')

  try {
    const response = await fetch(`https://world.openfoodfacts.org/api/v0/product/${decodedText}.json`)
    const data = await response.json()

    if (data.status === 1 && data.product && data.product.product_name) {
      const productName = data.product.product_name
      const fullName = data.product.brands ? `${data.product.brands} - ${productName}` : productName
      const qty = newItemQuantity.value.trim()
      await insertItem(fullName, qty)
    } else {
      alert(`Produit non trouvé pour le code barre: ${decodedText}`)
      newItemInput.value = decodedText
    }
  } catch (err) {
    console.error("OpenFoodFacts error", err)
    alert("Erreur réseau lors de la recherche du produit.")
  } finally {
    scannerStatus.textContent = "Scanning..."
    scannerContainer.classList.add('hidden')
  }
}


// --- Écouteurs globaux ---

function setupEventListeners() {
  authForm.addEventListener('submit', handleAuthSubmit)
  authToggleBtn.addEventListener('click', toggleAuthMode)
  logoutBtn.addEventListener('click', handleLogout)

  navList.addEventListener('click', () => switchView('view-list'))
  navShopping.addEventListener('click', () => switchView('view-shopping'))
  navProfile.addEventListener('click', () => switchView('view-profile'))
  createFamilyForm.addEventListener('submit', handleCreateFamily)
  clearCompletedBtn.addEventListener('click', archiveCompletedItems)
  saveTemplateBtn.addEventListener('click', handleSaveTemplate)
  applyTemplateBtn.addEventListener('click', handleApplyTemplate)
}

// --- Listes Types (Templates) ---

async function loadTemplates() {
  if (!activeFamilyId) return

  const { data, error } = await supabase
    .from('list_templates')
    .select('*')
    .eq('family_id', activeFamilyId)
    .order('name')

  if (error) {
    console.error('Erreur chargement templates', error)
    return
  }

  templateSelect.innerHTML = '<option value="">Charger une liste...</option>' +
    data.map(t => `<option value="${t.id}">${t.name}</option>`).join('')
}

async function handleSaveTemplate() {
  if (!activeFamilyId) return

  // 1. Récupérer les articles actifs
  const { data: items, error: fetchError } = await supabase
    .from('shopping_items')
    .select('name, quantity')
    .eq('family_id', activeFamilyId)
    .eq('is_archived', false)

  if (fetchError || !items || items.length === 0) {
    alert("La liste est vide ou inaccessible.")
    return
  }

  const name = prompt("Nom de cette liste type (ex: Hebdo, Barbecue...) :")
  if (!name) return

  try {
    // 2. Créer le template
    const { data: template, error: tError } = await supabase
      .from('list_templates')
      .insert([{ family_id: activeFamilyId, name }])
      .select()
      .single()

    if (tError) throw tError

    // 3. Créer les items du template
    const templateItems = items.map(it => ({
      template_id: template.id,
      name: it.name,
      quantity: it.quantity
    }))

    const { error: itemsError } = await supabase
      .from('list_template_items')
      .insert(templateItems)

    if (itemsError) throw itemsError

    alert("Liste type enregistrée !")
    loadTemplates()
  } catch (err) {
    console.error("Erreur sauvegarde template", err)
    alert("Un problème est survenu lors de l'enregistrement.")
  }
}

async function handleApplyTemplate() {
  const templateId = templateSelect.value
  if (!templateId) return

  if (!confirm("Voulez-vous ajouter les articles de cette liste type à votre liste actuelle ?")) return

  try {
    const { data: items, error } = await supabase
      .from('list_template_items')
      .select('name, quantity')
      .eq('template_id', templateId)

    if (error) throw error

    // On insère chaque article. La logique d'increment existante s'occupera du reste.
    for (const item of items) {
      await insertItem(item.name, item.quantity)
    }

    alert("Articles ajoutés !")
    loadShoppingItems()
  } catch (err) {
    console.error("Erreur application template", err)
    alert("Impossible d'appliquer la liste type.")
  }
}

// Lancer l'app
init()
