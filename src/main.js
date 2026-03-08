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

// Éléments DOM Auth
const authSection = document.getElementById('auth-section')
const mainSection = document.getElementById('main-section')
const authForm = document.getElementById('auth-form')
const emailInput = document.getElementById('email')
const passwordInput = document.getElementById('password')
const loginBtn = document.getElementById('login-btn')
const signupBtn = document.getElementById('signup-btn')
const authError = document.getElementById('auth-error')
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
  setupEventListeners()
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

async function handleLogin(e) {
  e.preventDefault()
  authError.classList.add('hidden')

  const { error } = await supabase.auth.signInWithPassword({
    email: emailInput.value,
    password: passwordInput.value,
  })

  if (error) {
    authError.textContent = error.message
    authError.classList.remove('hidden')
  }
}

async function handleSignup() {
  authError.classList.add('hidden')

  const { error } = await supabase.auth.signUp({
    email: emailInput.value,
    password: passwordInput.value,
  })

  if (error) {
    authError.textContent = error.message
    authError.classList.remove('hidden')
  } else {
    alert('Vérifiez votre email si nécessaire, ou connectez-vous directement !')
  }
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
    loadShoppingItems()
    updateProfileFamilyView()
    loadSuggestions()
  }
}

familySelect.addEventListener('change', (e) => {
  activeFamilyId = e.target.value
  loadShoppingItems()
  updateProfileFamilyView()
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
        <img alt="Membre" class="w-10 h-10 rounded-full object-cover" src="${isMe ? 'https://lh3.googleusercontent.com/aida-public/AB6AXuDlHpcljmtsN_fW-1my03yBu9MzDR-J8LVpSoBRx9ufvZ8lzJ4Ahru48elZ0-Q85oZStJpxwev2_JmgK5DBgusBdoE_l-mNaWT_vcQGrZeoS6rqIk6UUAbA-ZYa7LjBZZiOke-vLLDg9BG6fdm6xrmooZzgAPegLmQ4iWTSwca3GuwgDQVh1XhHiz9vjPj17zTS5LJnZZqozoyxsYAggZ3k54U1szQA6t75w7ptlmDEOqvvtcYQR-QG9YPZk0HS-y1pXm5b-VSPoz4' : avatar}"/>
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

  listCount.textContent = `${items.length} article${items.length > 1 ? 's' : ''}`

  const completedItems = items.filter(item => item.is_completed)
  const totalItems = items.length
  const progressPercent = totalItems === 0 ? 0 : Math.round((completedItems.length / totalItems) * 100)

  shoppingProgressText.textContent = `${progressPercent}%`
  shoppingCountText.textContent = `${completedItems.length} sur ${totalItems} article${totalItems > 1 ? 's' : ''}`
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
    const nameSpan = clone.querySelector('.item-name')
    const deleteBtn = clone.querySelector('.item-delete')
    const iconContainer = clone.querySelector('.item-icon-container')
    const iconSpan = clone.querySelector('.item-icon')
    const quantityText = clone.querySelector('.item-quantity')

    nameSpan.textContent = item.name
    quantityText.textContent = item.quantity || ''

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
    const nameSpan = clone.querySelector('.item-name')
    const checkbox = clone.querySelector('.item-checkbox')
    const quantityText = clone.querySelector('.item-quantity')

    nameSpan.textContent = item.name
    quantityText.textContent = item.quantity || ''
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

async function insertItem(name, quantity = '') {
  // Vérifier si un article avec le même nom existe déjà (même archivé)
  const { data: existing } = await supabase
    .from('shopping_items')
    .select('*')
    .eq('family_id', activeFamilyId)
    .eq('name', name)
    .maybeSingle()

  if (existing) {
    // Si il existe, on le réactive simplement et on met à jour la quantité
    const { error } = await supabase
      .from('shopping_items')
      .update({ is_archived: false, is_completed: false, quantity })
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
      await insertItem(fullName)
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
  loginBtn.addEventListener('click', handleLogin)
  signupBtn.addEventListener('click', (e) => {
    e.preventDefault()
    handleSignup()
  })
  logoutBtn.addEventListener('click', handleLogout)

  navList.addEventListener('click', () => switchView('view-list'))
  navShopping.addEventListener('click', () => switchView('view-shopping'))
  navProfile.addEventListener('click', () => switchView('view-profile'))
  createFamilyForm.addEventListener('submit', handleCreateFamily)
  clearCompletedBtn.addEventListener('click', archiveCompletedItems)
}

// Lancer l'app
init()
