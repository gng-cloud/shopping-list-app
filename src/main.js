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

// Éléments DOM
const authSection = document.getElementById('auth-section')
const mainSection = document.getElementById('main-section')
const authForm = document.getElementById('auth-form')
const emailInput = document.getElementById('email')
const passwordInput = document.getElementById('password')
const loginBtn = document.getElementById('login-btn')
const signupBtn = document.getElementById('signup-btn')
const authError = document.getElementById('auth-error')
const logoutBtn = document.getElementById('logout-btn')

const familySelect = document.getElementById('family-select')
const manageFamilyBtn = document.getElementById('manage-family-btn')

const addItemForm = document.getElementById('add-item-form')
const newItemInput = document.getElementById('new-item-input')
const shoppingList = document.getElementById('shopping-list')
const itemTemplate = document.getElementById('item-template')

const manageModal = document.getElementById('manage-modal')
const closeModalBtn = document.getElementById('close-modal-btn')
const modalFamilyName = document.getElementById('modal-family-name')
const ownerActions = document.getElementById('owner-actions')
const inviteForm = document.getElementById('invite-form')
const inviteEmail = document.getElementById('invite-email')
const inviteMsg = document.getElementById('invite-msg')
const membersList = document.getElementById('members-list')

const scanBtn = document.getElementById('scan-btn')
const scannerContainer = document.getElementById('scanner-container')
const closeScannerBtn = document.getElementById('close-scanner-btn')
const scannerStatus = document.getElementById('scanner-status')

// --- Initialisation ---

async function init() {
  const { data: { session } } = await supabase.auth.getSession()

  supabase.auth.onAuthStateChange((_event, session) => {
    handleAuthStateChange(session)
  })

  handleAuthStateChange(session)
  setupEventListeners()
}

// --- Authentification ---

function handleAuthStateChange(session) {
  currentUser = session?.user || null

  if (currentUser) {
    authSection.classList.add('hidden')
    mainSection.classList.remove('hidden')
    loadFamilies()
  } else {
    authSection.classList.remove('hidden')
    mainSection.classList.add('hidden')
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
    alert('Check your email for the login link or log in directly if email verification is disabled.')
  }
}

async function handleLogout() {
  await supabase.auth.signOut()
}

// --- Familles ---

async function loadFamilies() {
  // Récupérer les familles dont l'utilisateur est membre
  const { data, error } = await supabase
    .from('families')
    .select('*, family_members!inner(role)')

  if (error) {
    console.error('Erreur lors du chargement des familles', error)
    return
  }

  currentFamilies = data || []

  // Si le trigger n'a pas encore eu le temps de créer la famille après l'inscription, on réessaie dans 1s
  if (currentFamilies.length === 0) {
    setTimeout(loadFamilies, 1000)
    return
  }

  // Mettre à jour le selecteur
  familySelect.innerHTML = currentFamilies.map(f =>
    `<option value="${f.id}">${f.name}</option>`
  ).join('')

  if (currentFamilies.length > 0) {
    activeFamilyId = currentFamilies[0].id
    familySelect.value = activeFamilyId
    loadShoppingItems()
  }
}

familySelect.addEventListener('change', (e) => {
  activeFamilyId = e.target.value
  loadShoppingItems()
})

// --- Gestion des membres (Modal) ---

manageFamilyBtn.addEventListener('click', async () => {
  if (!activeFamilyId) return

  const activeFamily = currentFamilies.find(f => f.id === activeFamilyId)
  modalFamilyName.textContent = `👪 ${activeFamily.name}`

  // Vérifier si l'utilisateur est propriétaire
  const role = activeFamily.family_members[0].role
  if (role === 'owner') {
    ownerActions.classList.remove('hidden')
  } else {
    ownerActions.classList.add('hidden')
  }

  // Charger les membres
  inviteMsg.classList.add('hidden')
  await loadFamilyMembers()

  manageModal.classList.remove('hidden')
})

closeModalBtn.addEventListener('click', () => {
  manageModal.classList.add('hidden')
})

async function loadFamilyMembers() {
  // On trouve d'abord les family_members actuels
  const { data, error } = await supabase
    .from('family_members')
    .select('user_id, role')
    .eq('family_id', activeFamilyId)

  if (error) {
    console.error('Erreur membres', error)
    return
  }

  // Pour l'affichage MVP, on affiche juste l'ID ou 'Toi'
  membersList.innerHTML = data.map(m => `
    <li class="py-3 flex justify-between items-center group">
      <span class="text-sm font-semibold text-[#134E4A] dark:text-[#ccfbf1]">${m.user_id === currentUser.id ? 'Vous' : 'Membre (' + m.user_id.substring(0, 6) + '...)'}</span>
      <span class="px-3 py-1 inline-flex text-xs leading-5 font-bold rounded-full ${m.role === 'owner' ? 'bg-[#0D9488] text-white' : 'bg-[#ccfbf1] text-[#0D9488] dark:bg-[#0f766e] dark:text-[#ccfbf1]'}">
        ${m.role}
      </span>
    </li>
  `).join('')
}

inviteForm.addEventListener('submit', async (e) => {
  e.preventDefault()
  const email = inviteEmail.value
  inviteMsg.classList.remove('hidden')
  inviteMsg.textContent = 'Invitation en cours...'
  inviteMsg.className = 'text-sm mt-1 mb-4 text-blue-500'

  const { data, error } = await supabase.rpc('add_member_by_email', {
    p_email: email,
    p_family_id: activeFamilyId
  })

  if (error) {
    inviteMsg.textContent = 'Erreur : Utilisateur introuvable ou vous n\'avez pas les droits.'
    inviteMsg.className = 'text-sm mt-1 mb-4 text-red-500'
  } else {
    inviteMsg.textContent = 'Membre ajouté avec succès !'
    inviteMsg.className = 'text-sm mt-1 mb-4 text-green-500'
    inviteEmail.value = ''
    loadFamilyMembers()
  }
})


// --- Liste de courses ---

async function loadShoppingItems() {
  if (!activeFamilyId) return

  shoppingList.innerHTML = '<li class="p-6 text-center text-[#14B8A6] font-medium italic animate-pulse">Chargement des articles...</li>'

  const { data, error } = await supabase
    .from('shopping_items')
    .select('*')
    .eq('family_id', activeFamilyId)
    .order('created_at', { ascending: true })

  if (error) {
    console.error('Erreur lors du chargement des articles', error)
    return
  }

  renderShoppingList(data)
}

function renderShoppingList(items) {
  shoppingList.innerHTML = ''

  if (items.length === 0) {
    shoppingList.innerHTML = '<li class="p-6 text-center text-[#14B8A6] font-medium italic">Votre liste est vide. Ajoutez quelque chose ! ✨</li>'
    return
  }

  items.forEach(item => {
    const clone = itemTemplate.content.cloneNode(true)
    const li = clone.querySelector('li')
    const nameSpan = clone.querySelector('.item-name')
    const checkbox = clone.querySelector('.item-checkbox')
    const deleteBtn = clone.querySelector('.item-delete')

    nameSpan.textContent = item.name
    checkbox.checked = item.is_completed

    if (item.is_completed) {
      nameSpan.classList.add('line-through', 'text-[#14B8A6]', 'dark:text-[#5eead4]', 'opacity-50')
      li.classList.add('opacity-70') // Dim the whole card slightly
    }

    checkbox.addEventListener('change', () => toggleItem(item.id, checkbox.checked))
    deleteBtn.addEventListener('click', () => deleteItem(item.id))

    shoppingList.appendChild(li)
  })
}

addItemForm.addEventListener('submit', async (e) => {
  e.preventDefault()
  const name = newItemInput.value.trim()
  if (!name || !activeFamilyId) return

  await insertItem(name)
  newItemInput.value = ''
})

async function insertItem(name) {
  const { error } = await supabase
    .from('shopping_items')
    .insert([{ name, family_id: activeFamilyId }])

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
  const { error } = await supabase
    .from('shopping_items')
    .delete()
    .eq('id', id)

  if (error) {
    console.error('Erreur suppression article', error)
  } else {
    loadShoppingItems()
  }
}

// --- Scanner de code-barres (OpenFoodFacts) ---

scanBtn.addEventListener('click', async () => {
  scannerContainer.classList.remove('hidden')

  if (!html5QrCode) {
    html5QrCode = new Html5Qrcode("reader")
  }

  const config = { fps: 10, qrbox: { width: 250, height: 150 } }

  try {
    await html5QrCode.start(
      { facingMode: "environment" },
      config,
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
  // Ignore les erreurs de scan continues (pas de code dans le champ de vision)
}

async function onScanSuccess(decodedText, decodedResult) {
  // On arrête le scanner une fois le code trouvé
  await stopScanner()
  scannerStatus.textContent = "Recherche du produit..."

  try {
    const response = await fetch(`https://world.openfoodfacts.org/api/v0/product/${decodedText}.json`)
    const data = await response.json()

    if (data.status === 1 && data.product && data.product.product_name) {
      const productName = data.product.product_name
      // Si la marque est dispo, on l'ajoute
      const fullName = data.product.brands ? `${data.product.brands} - ${productName}` : productName
      await insertItem(fullName)
    } else {
      alert(`Produit non trouvé pour le code barre: ${decodedText}`)
      newItemInput.value = decodedText // On met le code barre dans le champ texte au cas où
    }
  } catch (err) {
    console.error("OpenFoodFacts error", err)
    alert("Erreur réseau lors de la recherche du produit.")
  } finally {
    scannerStatus.textContent = "Scanning..."
  }
}


// --- Écouteurs ---

function setupEventListeners() {
  loginBtn.addEventListener('click', handleLogin)
  signupBtn.addEventListener('click', (e) => {
    e.preventDefault()
    handleSignup()
  })
  logoutBtn.addEventListener('click', handleLogout)
}

// Lancer l'app
init()
