<template>
  <div class="container">
    <div class="header">
      <div class="flex items-center gap-4">
        <button class="btn-sm btn-secondary" @click="$router.back()">← Back</button>
        <div>
          <span class="badge" :class="project?.type === 'web' ? 'badge-info' : 'badge-warning'">
            {{ project?.type }}
          </span>
          <h2>{{ project?.name }}</h2>
        </div>
      </div>
      <button class="btn-primary" @click="openFeatureModal()">+ Add Feature</button>
    </div>

    <!-- Appium Server Status (for mobile projects) -->
    <div v-if="project?.type === 'mobile'" class="appium-status-section">
      <div class="section-header">
        <h3>Appium Server Status</h3>
        <div class="status-badge" :class="{ 'status-connected': appiumStatus.connected, 'status-disconnected': !appiumStatus.connected }">
          {{ appiumStatus.connected ? '✓ Connected' : '⚠️ Not Connected' }}
        </div>
      </div>
      <div class="appium-config">
        <div class="config-row">
          <span class="config-label">Server:</span>
          <span class="config-value">{{ project?.automationName || 'uiAutomator2' }} @ {{ project?.deviceName || 'Unknown Device' }}</span>
        </div>
        <div class="config-row">
          <span class="config-label">Endpoint:</span>
          <span class="config-value">http://{{ appiumConfig.host }}:{{ appiumConfig.port }}</span>
        </div>
      </div>
      <div v-if="!appiumStatus.connected" class="appium-warning">
        <p>⚠️ Appium server must be running before executing mobile tests.</p>
        <button class="btn-sm btn-primary" @click="checkAppiumServer" :disabled="appiumStatus.checking">
          {{ appiumStatus.checking ? 'Checking...' : 'Check Connection' }}
        </button>
      </div>
      <div v-else class="appium-success">
        <p>✓ Appium server is running and ready for testing.</p>
      </div>
    </div>

    <!-- Features List -->
    <div class="features-section">
      <div class="section-header">
        <h3>Features</h3>
        <span class="count">{{ features.length }} total</span>
      </div>
      <div class="features-grid" v-if="features.length">
        <div v-for="feature in features" :key="feature.id" class="feature-card">
          <div class="feature-card-header">
            <div class="feature-title">
              <h4>{{ feature.name }}</h4>
              <p v-if="feature.description">{{ feature.description }}</p>
            </div>
            <div class="feature-badges">
              <span class="badge" :class="feature.framework === 'playwright' ? 'badge-info' : 'badge-warning'">
                {{ feature.framework }}
              </span>
              <span class="badge" :class="feature.enabled ? 'badge-success' : 'badge-secondary'">
                {{ feature.enabled ? 'Active' : 'Inactive' }}
              </span>
            </div>
          </div>
          <div class="feature-card-body">
            <div class="feature-stats">
              <div class="stat">
                <span class="stat-icon">📋</span>
                <span>{{ getScenarioCount(feature.content) }} scenarios</span>
              </div>
              <div class="stat">
                <span class="stat-icon">📝</span>
                <span>{{ getStepCount(feature.content) }} steps</span>
              </div>
            </div>
            <div class="feature-preview">
              <pre>{{ getPreview(feature.content) }}</pre>
            </div>
          </div>
          <div class="feature-card-footer">
            <button class="btn-sm btn-secondary" @click="editFeature(feature)">
              <span>✏️</span> Edit
            </button>
            <button class="btn-sm btn-error" @click="confirmDeleteFeature(feature)">
              <span>🗑️</span> Delete
            </button>
          </div>
        </div>
      </div>
      <div v-else class="empty-state">
        <div class="empty-icon">📦</div>
        <h4>No features yet</h4>
        <p>Create your first feature to start testing</p>
        <button class="btn-primary" @click="openFeatureModal()">+ Add Feature</button>
      </div>
    </div>

    <!-- Run Tests Section -->
    <div class="run-section">
      <h3>Run Tests</h3>
      <div class="run-card">
        <p class="help-text">Select features to run in this test suite (drag to reorder):</p>
        <div class="feature-selector">
          <div v-for="(featureId, idx) in orderedFeatures" :key="featureId" class="feature-checkbox"
               draggable="true"
               @dragstart="onDragStart(idx)"
               @dragover.prevent
               @drop="onDrop(idx)">
            <span class="drag-handle">⋮⋮</span>
            <label class="checkbox-label">
              <input type="checkbox" :value="featureId" v-model="selectedFeatures" />
              <span class="checkbox-check"></span>
              <div class="checkbox-content">
                <span class="checkbox-name">{{ getFeatureById(featureId)?.name }}</span>
                <span class="checkbox-meta">{{ getScenarioCount(getFeatureById(featureId)?.content || '') }} scenarios · {{ getFeatureById(featureId)?.framework }}</span>
              </div>
            </label>
          </div>
        </div>

        <!-- Options -->
        <div class="run-options">
          <label class="option-checkbox">
            <input type="checkbox" v-model="recordTestRun" />
            <span class="option-check"></span>
            <span>📹 Record test run video</span>
          </label>
          <label class="option-checkbox">
            <input type="checkbox" v-model="takeScreenshots" />
            <span class="option-check"></span>
            <span>📸 Take screenshots</span>
          </label>
        </div>

        <div class="run-actions">
          <div class="run-summary">
            <span>{{ selectedFeatures.length }} feature{{ selectedFeatures.length !== 1 ? 's' : '' }} selected</span>
          </div>
          <button class="btn-primary btn-large" @click="runTests" :disabled="selectedFeatures.length === 0">
            <span>▶️</span> Run Tests
          </button>
        </div>
      </div>
    </div>

    <!-- Feature Modal -->
    <Teleport to="body">
      <div v-if="showFeatureModal" class="modal-overlay" @click.self="closeFeatureModal">
        <div class="modal modal-xxl">
          <div class="modal-header">
            <h3>{{ editingFeature ? 'Edit Feature' : 'New Feature' }}</h3>
            <button class="btn-icon" @click="closeFeatureModal">✕</button>
          </div>
          <form @submit.prevent="saveFeature">
            <div class="modal-body">
              <div class="form-row">
                <div class="form-group">
                  <label class="form-label" for="feature-name">Feature Name *</label>
                  <input id="feature-name" v-model="featureForm.name" required placeholder="e.g., User Login" />
                </div>
                <div class="form-group">
                  <label class="form-label" for="feature-framework">Framework *</label>
                  <select id="feature-framework" v-model="featureForm.framework" required>
                    <option value="playwright">🌐 Playwright (Web)</option>
                    <option value="wdio">📱 WDIO/Appium (Mobile)</option>
                  </select>
                </div>
              </div>
              <div class="form-group">
                <label class="form-label" for="feature-description">Description</label>
                <input id="feature-description" v-model="featureForm.description" placeholder="Brief description of what this feature tests..." />
              </div>

              <!-- AI Generator -->
              <div class="ai-generator">
                <div class="ai-header">
                  <label class="form-label" for="ai-description">
                    <span>✨</span> AI Generate Gherkin
                  </label>
                  <button type="button" class="btn-sm btn-primary" @click="generateWithAI" :disabled="aiGenerating || !aiDescription.trim()">
                    {{ aiGenerating ? 'Generating...' : 'Generate' }}
                  </button>
                </div>
                <textarea
                  id="ai-description"
                  v-model="aiDescription"
                  rows="3"
                  placeholder="Describe your test in plain language...

Example: I want to test the login functionality. User should be able to login with valid credentials and see error with invalid ones. Also test forgot password link."
                ></textarea>
              </div>

              <div class="form-group">
                <label class="form-label">
                  Gherkin Feature *
                  <span v-if="gherkinError" class="error-text">⚠️ {{ gherkinError }}</span>
                  <span v-else-if="gherkinValid" class="success-text">✓ Valid ({{ stepMatchCount }}/{{ totalSteps }} steps match)</span>
                </label>

                <!-- Boiler Plate Button -->
                <div class="boilerplate-section">
                  <div class="boilerplate-header">
                    <button type="button" class="btn-sm btn-primary" @click="showBoilerplateMenu = !showBoilerplateMenu">
                      📋 Gherkin Boiler Plate
                    </button>
                    <span v-if="selectedBoilerplate" class="selected-template">{{ selectedBoilerplate }}</span>
                  </div>
                  <div v-if="showBoilerplateMenu" class="boilerplate-menu">
                    <div class="boilerplate-category" v-for="cat in boilerplateCategories" :key="cat.name">
                      <h5>{{ cat.label }}</h5>
                      <div class="boilerplate-templates">
                        <button
                          v-for="tpl in cat.templates"
                          :key="tpl.name"
                          type="button"
                          class="boilerplate-btn"
                          @click="applyBoilerplate(tpl)"
                        >
                          <span class="template-icon">{{ tpl.icon }}</span>
                          <span class="template-name">{{ tpl.name }}</span>
                          <span class="template-desc">{{ tpl.description }}</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                <!-- Code Editor: Raw Gherkin textarea -->
                <div class="gherkin-editor">
                  <textarea v-model="featureForm.content" @input="onCodeEditorChange" rows="16" required
                    placeholder="Feature: Login Functionality

  Scenario: Successful login
    Given I navigate to &quot;https://example.com/login&quot;
    When I enter &quot;user@example.com&quot; into input field having id &quot;email&quot;
    And I click on element having css selector &quot;button[type='submit']&quot;
    Then the URL should contain &quot;/dashboard&quot;"></textarea>
                  <div class="gherkin-sidebar">
                    <!-- Step Library Search -->
                    <div class="step-library-search">
                      <input
                        v-model="stepSearchQuery"
                        type="text"
                        placeholder="Search steps..."
                        class="search-input"
                      />
                    </div>

                    <!-- Validation Errors -->
                    <div v-if="invalidSteps.length > 0" class="validation-errors">
                      <h4>⚠️ Invalid Steps</h4>
                      <div v-for="(err, idx) in invalidSteps" :key="idx" class="error-item">{{ err }}</div>
                    </div>

                    <!-- Step Library by Category -->
                    <div class="step-library">
                      <div v-for="cat in filteredStepCategories" :key="cat.name" class="step-category">
                        <h5 @click="toggleCategory(cat.name)" :class="{ 'collapsed': collapsedCategories.has(cat.name) }">
                          <span class="category-icon">{{ collapsedCategories.has(cat.name) ? '▶' : '▼' }}</span>
                          {{ cat.label }} ({{ cat.steps.length }})
                        </h5>
                        <div v-show="!collapsedCategories.has(cat.name)" class="step-list">
                          <div
                            v-for="step in cat.steps"
                            :key="step.id"
                            @click="insertStepFromLibrary(step)"
                            class="step-library-item"
                            :title="step.description || step.gherkinPattern"
                          >
                            <code class="step-pattern">{{ step.gherkinPattern }}</code>
                            <span v-if="step.description" class="step-desc">{{ step.description }}</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    <!-- Quick Reference -->
                    <div class="gherkin-help">
                      <h4>Quick Reference</h4>
                      <div class="syntax-item"><code>Feature:</code><span>Feature name</span></div>
                      <div class="syntax-item"><code>Scenario:</code><span>Test scenario</span></div>
                      <div class="syntax-item"><code>Given/When/Then</code><span>Step keywords</span></div>
                    </div>
                  </div>
                </div>
              </div>
              <div class="form-group">
                <div class="form-label toggle-label">
                  <label class="toggle-switch">
                    <input type="checkbox" v-model="featureForm.enabled" />
                    <span class="toggle-slider"></span>
                  </label>
                  <span>Enabled for testing</span>
                </div>
              </div>
            </div>
            <div class="modal-footer">
              <button type="button" class="btn-secondary" @click="closeFeatureModal">Cancel</button>
              <button type="submit" class="btn-primary">
                {{ editingFeature ? 'Save Changes' : 'Create Feature' }}
              </button>
            </div>
          </form>
        </div>
      </div>
    </Teleport>

    <!-- Delete Confirmation -->
    <Teleport to="body">
      <div v-if="deletingFeature" class="modal-overlay" @click.self="deletingFeature = null">
        <div class="modal modal-small">
          <div class="modal-header">
            <h3>Delete Feature?</h3>
          </div>
          <div class="modal-body">
            <p>Are you sure you want to delete <strong>{{ deletingFeature.name }}</strong>?</p>
            <p class="warning">This action cannot be undone.</p>
          </div>
          <div class="modal-footer">
            <button class="btn-secondary" @click="deletingFeature = null">Cancel</button>
            <button class="btn-error" @click="deleteFeature">Delete</button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted, watch, nextTick } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useProjectStore, type Feature } from '../stores/projects'
import { useTestRunStore } from '../stores/testRuns'
import { useStepDefinitionStore, type StepDefinition } from '../stores/stepDefinitions'

const route = useRoute()
const router = useRouter()
const projectStore = useProjectStore()
const testRunStore = useTestRunStore()
const stepStore = useStepDefinitionStore()

const projectId = route.params.id as string
const project = computed(() => projectStore.getProject(projectId))
const features = computed(() => projectStore.getProjectFeatures(projectId))
const enabledFeatures = computed(() => features.value.filter(f => f.enabled))
const stepDefinitions = computed(() => stepStore.steps.filter(s => s.enabled))

const showFeatureModal = ref(false)
const editingFeature = ref<Feature | null>(null)
const deletingFeature = ref<Feature | null>(null)
const selectedFeatures = ref<string[]>([])
const orderedFeatures = ref<string[]>([])
const recordTestRun = ref(false)
const takeScreenshots = ref(true)
const aiGenerating = ref(false)
const aiDescription = ref('')
const dragIdx = ref<number | null>(null)
const showBoilerplateMenu = ref(false)
const selectedBoilerplate = ref('')

// Boiler Plate Templates
interface BoilerplateTemplate {
  name: string
  description: string
  icon: string
  content: string
}

interface BoilerplateCategory {
  name: string
  label: string
  templates: BoilerplateTemplate[]
}

const boilerplateCategories: BoilerplateCategory[] = [
  {
    name: 'login',
    label: '🔐 Login & Authentication',
    templates: [
      {
        name: 'Basic Login',
        description: 'Simple login form test',
        icon: '🔑',
        content: `Feature: User Login
  As a registered user
  I want to login to my account
  So that I can access my dashboard

  Scenario: Successful login with valid credentials
    Given I navigate to "https://example.com/login"
    When I enter "user@example.com" into input field having id "email"
    And I enter "password123" into input field having id "password"
    And I click on element having css selector "button[type='submit']"
    Then the URL should contain "/dashboard"
    And I should see "Welcome" text on page

  Scenario: Login with invalid credentials
    Given I navigate to "https://example.com/login"
    When I enter "invalid@example.com" into input field having id "email"
    And I enter "wrongpassword" into input field having id "password"
    And I click on element having css selector "button[type='submit']"
    Then I should see "Invalid credentials" text on page
    And element having id "email" should be visible

  Scenario: Login with empty fields
    Given I navigate to "https://example.com/login"
    When I click on element having css selector "button[type='submit']"
    Then I should see "Email is required" text on page`
      },
      {
        name: 'Login with Scenario Outline',
        description: 'Data-driven login tests',
        icon: '📊',
        content: `Feature: User Login Data Driven
  As a registered user
  I want to login with different credentials
  So that I can verify the login functionality

  Scenario Outline: Login with different credentials
    Given I navigate to "https://example.com/login"
    When I enter "<email>" into input field having id "email"
    And I enter "<password>" into input field having id "password"
    And I click on element having css selector "button[type='submit']"
    Then I should see "<message>" text on page

    Examples:
      | email                | password     | message                   |
      | user@example.com     | pass123      | Welcome                   |
      | invalid@example.com  | wrongpass    | Invalid credentials       |
      |                      | pass123      | Email is required         |
      | user@example.com     |              | Password is required      |`
      }
    ]
  },
  {
    name: 'forms',
    label: '📝 Form Testing',
    templates: [
      {
        name: 'Contact Form',
        description: 'Complete contact form submission',
        icon: '✉️',
        content: `Feature: Contact Form
  As a website visitor
  I want to submit a contact form
  So that I can reach out to the support team

  Scenario: Submit contact form with valid data
    Given I navigate to "https://example.com/contact"
    When I enter "John Doe" into input field having id "name"
    And I enter "john@example.com" into input field having id "email"
    And I enter "This is a test message" into input field having id "message"
    And I click on element having id "submit-btn"
    Then I should see "Thank you for contacting us" text on page

  Scenario: Submit contact form with invalid email
    Given I navigate to "https://example.com/contact"
    When I enter "John Doe" into input field having id "name"
    And I enter "invalid-email" into input field having id "email"
    And I click on element having id "submit-btn"
    Then I should see "Please enter a valid email" text on page`
      },
      {
        name: 'Registration Form',
        description: 'User registration flow',
        icon: '📋',
        content: `Feature: User Registration
  As a new visitor
  I want to register an account
  So that I can access the platform features

  Scenario: Register with valid data
    Given I navigate to "https://example.com/register"
    When I enter "newuser@example.com" into input field having id "email"
    And I enter "JohnDoe123" into input field having id "username"
    And I enter "SecurePass123!" into input field having id "password"
    And I enter "SecurePass123!" into input field having id "confirm-password"
    And I check checkbox having id "terms"
    And I click on element having id "register-btn"
    Then the URL should contain "/welcome"
    And I should see "Registration successful" text on page

  Scenario Outline: Password validation
    Given I navigate to "https://example.com/register"
    When I enter "test@example.com" into input field having id "email"
    And I enter "<password>" into input field having id "password"
    And I enter "<password>" into input field having id "confirm-password"
    And I click on element having id "register-btn"
    Then I should see "<errorMessage>" text on page

    Examples:
      | password     | errorMessage                           |
      | 123          | Password must be at least 8 characters |
      | pass         | Password must contain a number         |
      | Password123  | Password must contain a special char   |`
      }
    ]
  },
  {
    name: 'navigation',
    label: '🧭 Navigation & Routing',
    templates: [
      {
        name: 'Page Navigation',
        description: 'Test navigation between pages',
        icon: '🔗',
        content: `Feature: Page Navigation
  As a website user
  I want to navigate between pages
  So that I can access different sections

  Background:
    Given I navigate to "https://example.com"

  Scenario: Navigate to About page
    When I click on element having css selector "a[href='/about']"
    Then the URL should be "https://example.com/about"
    And element having id "about-content" should be visible

  Scenario: Navigate using main menu
    When I click on element having css selector "nav a[href='/products']"
    Then the URL should contain "/products"
    And I should see "Our Products" text on page

  Scenario: Browser back button
    Given I navigate to "https://example.com/products"
    When I click on element having css selector "a[href='/about']"
    And I go back in browser
    Then the URL should contain "/products"`
      },
      {
        name: 'Search & Filter',
        description: 'Search functionality with filters',
        icon: '🔍',
        content: `Feature: Search and Filter
  As a website user
  I want to search and filter products
  So that I can find what I'm looking for

  Scenario: Search with keyword
    Given I navigate to "https://example.com/products"
    When I enter "laptop" into input field having id "search-input"
    And I click on element having css selector "button[aria-label='Search']"
    Then I should see "laptop" text on page
    And there should be more than 0 elements with css selector ".product-card"

  Scenario: Filter by category
    Given I navigate to "https://example.com/products"
    When I click on element having css selector "button[data-category='electronics']"
    And I wait for element having id "products-grid" to be visible
    Then element having id "category-badge" should be visible
    And I should see "Electronics" text in element having id "category-badge"`
      }
    ]
  },
  {
    name: 'ecommerce',
    label: '🛒 E-commerce',
    templates: [
      {
        name: 'Shopping Cart',
        description: 'Add to cart and checkout flow',
        icon: '🛒',
        content: `Feature: Shopping Cart
  As a customer
  I want to add products to cart and checkout
  So that I can complete my purchase

  Scenario: Add product to cart
    Given I navigate to "https://example.com/products/laptop-123"
    When I click on element having id "add-to-cart-btn"
    Then I should see "Added to cart" text on page
    And element having id "cart-count" should be visible

  Scenario: Complete checkout flow
    Given I navigate to "https://example.com/cart"
    When I click on element having css selector "button[data-test='checkout']"
    And I enter "123 Main St" into input field having id "shipping-address"
    And I enter "New York" into input field having id "city"
    And I enter "10001" into input field having id "zip"
    And I click on element having id "place-order-btn"
    Then the URL should contain "/order-confirmation"
    And I should see "Order placed successfully" text on page`
      }
    ]
  }
]

function applyBoilerplate(tpl: BoilerplateTemplate) {
  featureForm.content = tpl.content
  selectedBoilerplate.value = tpl.name
  showBoilerplateMenu.value = false
  // Extract feature name for the form field
  const match = tpl.content.match(/^Feature:\s*(.+?)(?:\n|$)/m)
  if (match) {
    featureForm.name = match[1].trim()
  }
  validateGherkin()
}

// Appium Server Status (for mobile projects)
const appiumStatus = reactive({
  connected: false,
  checking: false,
  lastChecked: null as Date | null
})

const appiumConfig = reactive({
  host: 'localhost',
  port: 4723
})

async function checkAppiumServer() {
  if (!project.value || project.value.type !== 'mobile') return

  appiumStatus.checking = true
  try {
    const response = await fetch('/api/appium/status', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        host: project.value.deviceName ? 'localhost' : appiumConfig.host,
        port: appiumConfig.port
      })
    })
    const data = await response.json()
    appiumStatus.connected = data.connected || false
    appiumStatus.lastChecked = new Date()
  } catch (e) {
    appiumStatus.connected = false
    console.error('Failed to check Appium server:', e)
  } finally {
    appiumStatus.checking = false
  }
}

// Step Builder
const selectedStepCategory = ref('')
const selectedStepDef = ref('')
const selectedStepDefData = ref<StepDefinition | null>(null)
const paramValues = ref<Record<string, string>>({})
const gherkinValid = ref(false)
const gherkinError = ref('')
const stepPreviewText = ref('')
const invalidSteps = ref<string[]>([])
const validStepsList = ref<string[]>([])
const stepMatchCount = ref(0)
const totalSteps = ref(0)

// Step Library for code editor
const stepSearchQuery = ref('')
const collapsedCategories = ref<Set<string>>(new Set())

const filteredStepCategories = computed(() => {
  const query = stepSearchQuery.value.toLowerCase().trim()
  return stepCategories.value.map(cat => {
    const filteredSteps = query
      ? cat.steps.filter(s =>
          s.gherkinPattern.toLowerCase().includes(query) ||
          s.description?.toLowerCase().includes(query)
        )
      : cat.steps
    return { ...cat, steps: filteredSteps }
  }).filter(c => c.steps.length > 0)
})

function toggleCategory(name: string) {
  const set = collapsedCategories.value
  if (set.has(name)) {
    set.delete(name)
  } else {
    set.add(name)
  }
  collapsedCategories.value = new Set(set)
}

function insertStepFromLibrary(stepDef: StepDefinition) {
  // Determine keyword (default to And if there's already content)
  const content = featureForm.content.trim()
  const keyword = content.length > 0 ? '  And' : '  When'

  // Build step text with default/example values
  let stepText = stepDef.gherkinPattern
  if (stepDef.parameters && stepDef.parameters.length > 0) {
    for (const param of stepDef.parameters) {
      const exampleValue = param.default || getExampleValue(param.type)
      stepText = stepText.replace(`{${param.name}}`, exampleValue)
    }
  }

  // Append to content
  featureForm.content += `\n${keyword} ${stepText}`

  // Trigger validation
  validateGherkin()

  // Focus textarea
  nextTick(() => {
    const textarea = document.querySelector('.gherkin-editor textarea') as HTMLTextAreaElement
    if (textarea) {
      textarea.focus()
      textarea.scrollTop = textarea.scrollHeight
    }
  })
}

function getExampleValue(type: string): string {
  const examples: Record<string, string> = {
    'string': '"example"',
    'number': '123',
    'url': '"https://example.com"',
    'id': '"element-id"',
    'selector': '".my-class"',
    'css': '"button[type=\'submit\']"'
  }
  return examples[type] || examples['string']
}

const filteredStepDefs = computed(() => {
  let steps = stepDefinitions.value
  if (selectedStepCategory.value) {
    steps = steps.filter(s => s.category === selectedStepCategory.value)
  }
  return steps
})

// Step categories for visual editor
const stepCategories = computed(() => {
  const cats = [
    { name: 'navigation', label: '🧭 Navigation' },
    { name: 'input', label: '⌨️ Input' },
    { name: 'click', label: '👆 Click' },
    { name: 'assertion', label: '✓ Assertion' },
    { name: 'wait', label: '⏱️ Wait' },
    { name: 'form', label: '📋 Form' },
    { name: 'scroll', label: '📜 Scroll' },
    { name: 'screenshot', label: '📸 Screenshot' },
    { name: 'script', label: '🔧 Script' },
    { name: 'attribute', label: '🏷️ Attribute' },
  ]
  return cats.map(cat => ({
    ...cat,
    steps: stepDefinitions.value.filter(s => s.category === cat.name)
  })).filter(c => c.steps.length > 0)
})

// Sync between visual and code editor (removed - code editor only)
function syncFromCodeToVisual() {
  // No-op - visual editor removed
}

function syncFromVisualToCode() {
  // No-op - visual editor removed
}

function findMatchingStepDef(stepText: string): StepDefinition | null {
  // Normalise: strip surrounding quotes from the full step text for matching
  for (const stepDef of stepDefinitions.value) {
    let pattern = stepDef.gherkinPattern
    // Escape regex specials (but not our {param} placeholders)
    pattern = pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&')
    // Replace \{param\} with a group that matches: "value", 'value', <value>, or bare word(s)
    pattern = pattern.replace(/\\{([^}]+)\\}/g, '(?:"([^"]*)"|\u0027([^\u0027]*)\u0027|<([^>]*)>|([\\S]+(?:\\s+[\\S]+)*))')
    try {
      if (new RegExp(`^${pattern}$`, 'i').test(stepText)) {
        return stepDef
      }
    } catch { /* invalid regex, skip */ }
  }
  return null
}

function extractParamValues(stepText: string, stepDef: StepDefinition | null): Record<string, string> {
  if (!stepDef) return {}

  const values: Record<string, string> = {}

  // If we have parameter metadata, use it
  if (stepDef.parameters && stepDef.parameters.length > 0) {
    let pattern = stepDef.gherkinPattern
    const paramNames: string[] = []

    // Replace parameters with temporary tokens BEFORE escaping
    let tempPattern = pattern
    for (let i = 0; i < stepDef.parameters.length; i++) {
      const param = stepDef.parameters[i]
      tempPattern = tempPattern.replace(`{${param.name}}`, `__PARAM_${i}__`)
      paramNames.push(param.name)
    }

    // Escape special regex characters
    tempPattern = tempPattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&')

    // Replace tokens with capture groups
    tempPattern = tempPattern.replace(/__PARAM_(\d+)__/g, '(.+?)')

    try {
      const regex = new RegExp(`^${tempPattern}$`, 'i')
      const match = stepText.match(regex)
      if (match) {
        for (let i = 0; i < paramNames.length; i++) {
          let rawValue = match[i + 1] || ''
          rawValue = rawValue.replace(/^["']|["']$/g, '')
          values[paramNames[i]] = rawValue
        }
        return values
      }
    } catch {}
  }

  // Fallback: extract values by pattern matching without parameter metadata
  // This handles cases where parameters exist but aren't defined in metadata
  let pattern = stepDef.gherkinPattern

  // Count placeholders in pattern
  const placeholderCount = (pattern.match(/\{[^}]+\}/g) || []).length

  if (placeholderCount === 0) return values

  // Escape special chars and replace placeholders with capture groups
  let escapedPattern = pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&')
  escapedPattern = escapedPattern.replace(/\\{([^}]+)\\}/g, '(?:"([^"]*)"|\'([^\']*)\'|([^\\s"]+(?:\\s+[^\\s"]+)*))')

  try {
    const regex = new RegExp(`^${escapedPattern}$`, 'i')
    const match = stepText.match(regex)

    if (match) {
      // Extract values from capture groups (group 1 = double quoted, 2 = single quoted, 3 = unquoted)
      let paramIndex = 0
      for (let i = 1; i < match.length; i += 3) {
        if (i + 2 < match.length) {
          const value = match[i] || match[i + 1] || match[i + 2] || ''
          const paramNames = stepDef.parameters?.map(p => p.name) || []

          if (paramIndex < paramNames.length) {
            values[paramNames[paramIndex]] = value
          } else {
            // Generate param name if metadata missing
            values[`param${paramIndex + 1}`] = value
          }
          paramIndex++
        }
      }
    }
  } catch {}

  return values
}

// Visual editor actions
function addScenario() {
  scenarios.value.push({ name: 'New Scenario', isOutline: false, steps: [], examples: [] })
  syncFromVisualToCode()
}

function toggleScenarioOutline(scenarioIdx: number) {
  const scenario = scenarios.value[scenarioIdx]
  scenario.isOutline = !scenario.isOutline
  if (scenario.isOutline && scenario.examples.length === 0) {
    // Initialize with example headers from step parameters
    const headers = new Set<string>()
    for (const step of scenario.steps) {
      if (step.matchedDef?.parameters) {
        for (const param of step.matchedDef.parameters) {
          headers.add(param.name)
        }
      }
    }
    if (headers.size > 0) {
      const emptyRow: ExampleRow = {}
      headers.forEach(h => emptyRow[h] = '')
      scenario.examples = [emptyRow]
    }
  }
  syncFromVisualToCode()
}

function removeScenario(idx: number) {
  scenarios.value.splice(idx, 1)
  syncFromVisualToCode()
}

// Background steps functions
function addBackgroundStep() {
  backgroundSteps.value.push({
    keyword: 'Given',
    stepDefId: '',
    matchedDef: null,
    paramValues: {},
    text: ''
  })
  syncFromVisualToCode()
}

function removeBackgroundStep(stepIdx: number) {
  backgroundSteps.value.splice(stepIdx, 1)
  syncFromVisualToCode()
}

function moveBackgroundStep(stepIdx: number, direction: number) {
  const steps = backgroundSteps.value
  const newIdx = stepIdx + direction
  if (newIdx >= 0 && newIdx < steps.length) {
    const [removed] = steps.splice(stepIdx, 1)
    steps.splice(newIdx, 0, removed)
    syncFromVisualToCode()
  }
}

function onBackgroundStepDefChange(step: ScenarioStep, _stepIdx: number) {
  step.matchedDef = stepDefinitions.value.find(s => s.id === step.stepDefId) || null
  if (step.matchedDef) {
    // Ensure parameters array is populated from pattern if missing
    if (!step.matchedDef.parameters || step.matchedDef.parameters.length === 0) {
      const placeholderMatches = step.matchedDef.gherkinPattern.match(/\{([^}]+)\}/g)
      if (placeholderMatches) {
        step.matchedDef.parameters = placeholderMatches.map((name) => ({
          name: name.replace(/[{}]/g, ''),
          type: 'string' as const,
          default: ''
        }))
      }
    }

    step.paramValues = {}
    if (step.matchedDef.parameters) {
      for (const param of step.matchedDef.parameters) {
        step.paramValues[param.name] = param.default || ''
      }
    }
    updateBackgroundStepText(step)
    syncFromVisualToCode()
  }
}

function updateBackgroundStepText(step: ScenarioStep) {
  if (!step.matchedDef) {
    step.text = ''
    return
  }

  let text = step.matchedDef.gherkinPattern
  if (step.matchedDef.parameters) {
    for (const param of step.matchedDef.parameters) {
      const value = step.paramValues[param.name] || param.default || `<${param.name}>`
      text = text.split(`{${param.name}}`).join(value)
    }
  }
  step.text = text
  syncFromVisualToCode()
}

function addStep(scenarioIdx: number) {
  scenarios.value[scenarioIdx].steps.push({
    keyword: 'When',
    stepDefId: '',
    matchedDef: null,
    paramValues: {},
    text: ''
  })

  // Update examples table headers if scenario is outline
  const scenario = scenarios.value[scenarioIdx]
  if (scenario.isOutline) {
    const headers = new Set<string>()
    for (const step of scenario.steps) {
      if (step.matchedDef?.parameters) {
        for (const param of step.matchedDef.parameters) {
          headers.add(param.name)
        }
      }
    }
    // Update existing examples rows to include new columns
    if (scenario.examples.length > 0) {
      for (const row of scenario.examples) {
        headers.forEach(h => {
          if (!(h in row)) {
            row[h] = ''
          }
        })
      }
    }
  }

  syncFromVisualToCode()
}

function removeStep(scenarioIdx: number, stepIdx: number) {
  scenarios.value[scenarioIdx].steps.splice(stepIdx, 1)
  syncFromVisualToCode()
}

function moveStep(scenarioIdx: number, stepIdx: number, direction: number) {
  const steps = scenarios.value[scenarioIdx].steps
  const newIdx = stepIdx + direction
  if (newIdx >= 0 && newIdx < steps.length) {
    const [removed] = steps.splice(stepIdx, 1)
    steps.splice(newIdx, 0, removed)
    syncFromVisualToCode()
  }
}

function onStepDefChange(step: ScenarioStep, scenarioIdx: number, _stepIdx: number) {
  step.matchedDef = stepDefinitions.value.find(s => s.id === step.stepDefId) || null
  if (step.matchedDef) {
    // Ensure parameters array is populated from pattern if missing
    if (!step.matchedDef.parameters || step.matchedDef.parameters.length === 0) {
      const placeholderMatches = step.matchedDef.gherkinPattern.match(/\{([^}]+)\}/g)
      if (placeholderMatches) {
        step.matchedDef.parameters = placeholderMatches.map((name, i) => ({
          name: name.replace(/[{}]/g, ''),
          type: 'string' as const,
          default: ''
        }))
      }
    }

    // Initialize param values with defaults
    step.paramValues = {}
    if (step.matchedDef.parameters) {
      for (const param of step.matchedDef.parameters) {
        step.paramValues[param.name] = param.default || ''
      }

      // Update examples table if scenario is outline
      const scenario = scenarios.value[scenarioIdx]
      if (scenario.isOutline) {
        for (const row of scenario.examples) {
          for (const param of step.matchedDef!.parameters) {
            if (!(param.name in row)) {
              row[param.name] = ''
            }
          }
        }
      }
    }
    updateStepText(step)
    syncFromVisualToCode()
  }
}

function updateStepText(step: ScenarioStep) {
  if (!step.matchedDef) {
    step.text = ''
    return
  }

  let text = step.matchedDef.gherkinPattern
  if (step.matchedDef.parameters) {
    for (const param of step.matchedDef.parameters) {
      const value = step.paramValues[param.name] || param.default || `<${param.name}>`
      text = text.split(`{${param.name}}`).join(value)
    }
  }
  step.text = text
  syncFromVisualToCode()
}

function addExampleRow(scenarioIdx: number) {
  const scenario = scenarios.value[scenarioIdx]
  if (scenario.examples.length === 0) {
    // Get headers from step parameters
    const headers = new Set<string>()
    for (const step of scenario.steps) {
      if (step.matchedDef?.parameters) {
        for (const param of step.matchedDef.parameters) {
          headers.add(param.name)
        }
      }
    }
    const emptyRow: ExampleRow = {}
    headers.forEach(h => emptyRow[h] = '')
    scenario.examples.push(emptyRow)
  } else {
    // Clone the last row or create empty from headers
    const headers = Object.keys(scenario.examples[0])
    const newRow: ExampleRow = {}
    headers.forEach(h => newRow[h] = '')
    scenario.examples.push(newRow)
  }
  syncFromVisualToCode()
}

function removeExampleRow(scenarioIdx: number, rowIdx: number) {
  scenarios.value[scenarioIdx].examples.splice(rowIdx, 1)
  syncFromVisualToCode()
}

function getExampleHeaders(scenario: Scenario): string[] {
  if (scenario.examples.length === 0) return []
  return Object.keys(scenario.examples[0])
}

function addExampleColumn(scenarioIdx: number, columnName: string) {
  const scenario = scenarios.value[scenarioIdx]
  for (const row of scenario.examples) {
    row[columnName] = ''
  }
  syncFromVisualToCode()
}

function removeExampleColumn(scenarioIdx: number, columnName: string) {
  const scenario = scenarios.value[scenarioIdx]
  for (const row of scenario.examples) {
    delete row[columnName]
  }
  syncFromVisualToCode()
}

function onCodeEditorChange() {
  // Just validate gherkin on code change
  validateGherkin()
}

// When opening modal, ensure step definitions are loaded
watch(() => showFeatureModal.value, async (isOpen) => {
  if (isOpen) {
    // Wait for DOM to settle
    await nextTick()
    // Ensure step definitions are loaded
    if (stepDefinitions.value.length === 0) {
      await stepStore.fetchStepDefinitions(projectId)
    }
    // Validate current content
    validateGherkin()
  }
})

const defaultGherkin = `Feature: New Feature
  As a user
  I want to perform an action
  So that I can achieve a goal

  Scenario: Example scenario
    Given I am on the page
    When I perform an action
    Then I should see the expected result`

const featureForm = reactive({
  name: '',
  framework: 'playwright' as 'playwright' | 'wdio',
  description: '',
  content: defaultGherkin,
  enabled: true
})

async function openFeatureModal() {
  editingFeature.value = null
  resetFeatureForm()
  // Auto-seed step library if empty
  if (stepDefinitions.value.length === 0) {
    try {
      await stepStore.importFromLibrary(projectId, 'playwright')
      await stepStore.fetchStepDefinitions(projectId)
    } catch { /* silently ignore if already imported */ }
  }
  showFeatureModal.value = true
  // Wait for DOM update
  await nextTick()
  await nextTick()
  // Validate default content
  validateGherkin()
}

function closeFeatureModal() {
  showFeatureModal.value = false
  editingFeature.value = null
  aiDescription.value = ''
  resetFeatureForm()
}

async function editFeature(feature: Feature) {
  editingFeature.value = feature
  Object.assign(featureForm, {
    name: feature.name,
    framework: feature.framework,
    description: feature.description || '',
    content: feature.content,
    enabled: !!feature.enabled
  })
  // Ensure step definitions are loaded FIRST
  await stepStore.fetchStepDefinitions(projectId)
  // Auto-seed if still empty
  if (stepStore.steps.length === 0) {
    try {
      await stepStore.importFromLibrary(projectId, 'playwright')
      // Fetch again after import to ensure we have the steps
      await stepStore.fetchStepDefinitions(projectId)
    } catch { /* ignore */ }
  }
  // Open modal first
  showFeatureModal.value = true
  // Wait for DOM update AND reactivity
  await nextTick()
  await nextTick()
  // Validate the loaded content
  validateGherkin()
}

function confirmDeleteFeature(feature: Feature) {
  deletingFeature.value = feature
}

async function saveFeature() {
  // Validate before saving
  validateGherkin()
  const data = { ...featureForm, projectId, enabled: featureForm.enabled ? 1 : 0 }
  if (editingFeature.value) {
    await projectStore.updateFeature(editingFeature.value.id, data)
  } else {
    await projectStore.createFeature(data)
  }
  closeFeatureModal()
  await projectStore.fetchFeatures(projectId)
}

async function deleteFeature() {
  if (deletingFeature.value) {
    await projectStore.deleteFeature(deletingFeature.value.id)
    deletingFeature.value = null
    await projectStore.fetchFeatures(projectId)
  }
}

function resetFeatureForm() {
  Object.assign(featureForm, {
    name: '',
    framework: 'playwright',
    description: '',
    content: defaultGherkin,
    enabled: true
  })
}

function getScenarioCount(content: string): number {
  const matches = content.match(/^\s*Scenario:/gim)
  return matches ? matches.length : 0
}

function getStepCount(content: string): number {
  const matches = content.match(/^\s*(Given|When|Then|And|But)\s/gim)
  return matches ? matches.length : 0
}

function getPreview(content: string): string {
  const lines = content.split('\n').filter(l => l.trim() && !l.trim().startsWith('#'))
  return lines.slice(0, 4).join('\n') + (lines.length > 4 ? '\n...' : '')
}

async function runTests() {
  // Use selected features in their current order
  const featuresToRun = orderedFeatures.value.filter(id => selectedFeatures.value.includes(id))
  const run = await testRunStore.createTestRun(projectId, featuresToRun, {
    recordTestRun: recordTestRun.value,
    takeScreenshots: takeScreenshots.value
  })
  await testRunStore.runTest(run.id)
  router.push(`/test-runs/${run.id}`)
}

function getFeatureById(id: string) {
  return features.value.find(f => f.id === id)
}

function onDragStart(idx: number) {
  dragIdx.value = idx
}

function onDrop(idx: number) {
  if (dragIdx.value === null || dragIdx.value === idx) return
  const item = orderedFeatures.value.splice(dragIdx.value, 1)[0]
  orderedFeatures.value.splice(idx, 0, item)
  dragIdx.value = null
}

async function generateWithAI() {
  if (!aiDescription.value.trim()) return

  aiGenerating.value = true
  try {
    const res = await fetch('/api/ai/gherkin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        description: aiDescription.value,
        framework: featureForm.framework
      })
    })

    if (!res.ok) {
      const err = await res.json()
      throw new Error(err.error || 'Failed to generate')
    }

    const data = await res.json()
    featureForm.content = data.content

    // Auto-fill name from generated content if empty
    if (!featureForm.name) {
      const match = data.content.match(/Feature:\s*(.+?)(?:\n|$)/i)
      if (match) featureForm.name = match[1].trim()
    }
  } catch (err: any) {
    alert('AI Generation failed: ' + err.message)
  } finally {
    aiGenerating.value = false
  }
}

// Step Builder functions
function filterSteps() {
  selectedStepDef.value = ''
  selectedStepDefData.value = null
  paramValues.value = {}
}

watch(selectedStepDef, (newId) => {
  if (newId) {
    selectedStepDefData.value = stepDefinitions.value.find(s => s.id === newId) || null
    paramValues.value = {}
    // Set default values
    if (selectedStepDefData.value?.parameters) {
      for (const param of selectedStepDefData.value.parameters) {
        paramValues.value[param.name] = param.default || ''
      }
    }
  }
})

function insertStep() {
  if (!selectedStepDefData.value) return

  const step = selectedStepDefData.value
  let stepText = step.gherkinPattern

  // Replace parameters with values
  if (step.parameters) {
    for (const param of step.parameters) {
      const value = paramValues.value[param.name] || param.default || `{${param.name}}`
      stepText = stepText.split(`{${param.name}}`).join(value)
    }
  }

  // Determine keyword (default to And if there's already content)
  const hasContent = featureForm.content.trim().length > 0
  const keyword = hasContent ? '  And' : '  When'

  featureForm.content += `\n${keyword} ${stepText}`
  validateGherkin()

  // Reset selection
  selectedStepDef.value = ''
  selectedStepDefData.value = null
  paramValues.value = {}
}

function updateStepPreview() {
  if (!selectedStepDefData.value) {
    stepPreviewText.value = ''
    return
  }

  const step = selectedStepDefData.value
  let preview = step.gherkinPattern

  // Replace parameters with values
  if (step.parameters) {
    for (const param of step.parameters) {
      const value = paramValues.value[param.name] || param.default || `{${param.name}}`
      preview = preview.split(`{${param.name}}`).join(value)
    }
  }

  stepPreviewText.value = `  When ${preview}`
}

watch(selectedStepDef, (newId) => {
  if (newId) {
    selectedStepDefData.value = stepDefinitions.value.find(s => s.id === newId) || null
    paramValues.value = {}
    // Set default values
    if (selectedStepDefData.value?.parameters) {
      for (const param of selectedStepDefData.value.parameters) {
        paramValues.value[param.name] = param.default || ''
      }
    }
    updateStepPreview()
  }
})

function validateGherkin() {
  const content = featureForm.content.trim()
  gherkinError.value = ''
  gherkinValid.value = false
  invalidSteps.value = []
  validStepsList.value = []
  stepMatchCount.value = 0
  totalSteps.value = 0

  if (!content) {
    return
  }

  const errors: string[] = []

  // Check for Feature keyword
  if (!content.match(/^Feature:\s+/m)) {
    errors.push('Missing "Feature:" keyword')
  }

  // Check for Scenario keyword
  if (!content.match(/^\s*Scenario:\s+/m)) {
    errors.push('Missing "Scenario:" keyword')
  }

  // Extract and validate each step
  const stepLines = content.match(/^\s*(Given|When|Then|And|But)\s+(.+)$/gm)
  if (stepLines) {
    totalSteps.value = stepLines.length

    for (const line of stepLines) {
      const stepText = line.replace(/^\s*(Given|When|Then|And|But)\s+/, '')
      let matched = false

      // Check against step definitions from database
      for (const stepDef of stepDefinitions.value) {
        // Convert gherkin pattern to regex
        // e.g., "I enter {value} into input field having id {id}"
        // becomes /^I enter (.+) into input field having id (.+)$/
        let pattern = stepDef.gherkinPattern

        // Escape special regex characters except for our placeholders
        pattern = pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&')

        // Replace {param} with capture group
        pattern = pattern.replace(/\\{([^}]+)\\}/g, '(.+?)')

        // Allow quotes (single or double) around parameters
        pattern = pattern.replace(/\\(\\.\\+\\?\\)/g, '("([^"]*)"|\'([^\']*)\'|[^\\s]+)')

        try {
          if (new RegExp(`^${pattern}$`, 'i').test(stepText)) {
            matched = true
            stepMatchCount.value++
            validStepsList.value.push(stepText)
            break
          }
        } catch (e) {
          // Invalid regex, skip
        }
      }

      if (!matched) {
        invalidSteps.value.push(`Step not in library: "${stepText}"`)
      }
    }
  }

  // Check for proper indentation
  const lines = content.split('\n')
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i]
    if (line.match(/^(Given|When|Then|And|But)/)) {
      if (!line.match(/^s/)) {
        errors.push('Step keywords need indentation')
        break
      }
    }
  }

  if (errors.length > 0) {
    gherkinError.value = errors[0]
  } else if (invalidSteps.value.length === 0) {
    gherkinValid.value = true
  }
}

onMounted(() => {
  projectStore.fetchFeatures(projectId)
  testRunStore.fetchTestRuns(projectId)
  stepStore.fetchStepDefinitions(projectId)
  // Initialize ordered features with enabled feature IDs
  orderedFeatures.value = enabledFeatures.value.map(f => f.id)
})

// Update orderedFeatures when features change
watch(enabledFeatures, (newFeatures) => {
  const currentIds = new Set(orderedFeatures.value)
  const newIds = newFeatures.map(f => f.id)
  // Add new features
  for (const id of newIds) {
    if (!currentIds.has(id)) {
      orderedFeatures.value.push(id)
    }
  }
  // Remove deleted features
  orderedFeatures.value = orderedFeatures.value.filter(id => newIds.includes(id))
}, { deep: true })
</script>

<style scoped>
.container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 1rem;
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 2rem;
  padding-bottom: 1rem;
  border-bottom: 1px solid var(--border);
}

.header h2 {
  margin: 0.5rem 0 0 0;
  font-size: 1.5rem;
}

.features-section,
.run-section,
.appium-status-section {
  margin-bottom: 2.5rem;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}

.section-header h3 {
  margin: 0;
  font-size: 1.125rem;
}

.count {
  color: var(--text-secondary);
  font-size: 0.875rem;
}

.features-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(450px, 1fr));
  gap: 1.25rem;
}

.feature-card {
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: 0.75rem;
  overflow: hidden;
  transition: all 0.2s;
}

.feature-card:hover {
  border-color: var(--accent);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
}

.feature-card-header {
  padding: 1.25rem;
  border-bottom: 1px solid var(--border);
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 1rem;
}

.feature-title h4 {
  margin: 0 0 0.25rem 0;
  font-size: 1rem;
  font-weight: 600;
}

.feature-title p {
  margin: 0;
  color: var(--text-secondary);
  font-size: 0.875rem;
}

.feature-badges {
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
  flex-shrink: 0;
}

.badge-secondary {
  background: var(--bg-tertiary);
  color: var(--text-secondary);
}

.feature-card-body {
  padding: 1.25rem;
}

.feature-stats {
  display: flex;
  gap: 1.5rem;
  margin-bottom: 1rem;
}

.stat {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.875rem;
  color: var(--text-secondary);
}

.stat-icon {
  font-size: 1rem;
}

.feature-preview {
  background: var(--bg-primary);
  border: 1px solid var(--border);
  border-radius: 0.5rem;
  padding: 0.75rem;
  overflow: hidden;
}

.feature-preview pre {
  margin: 0;
  font-family: 'Monaco', 'Menlo', monospace;
  font-size: 0.75rem;
  color: var(--text-secondary);
  white-space: pre-wrap;
  line-height: 1.5;
}

.feature-card-footer {
  padding: 1rem 1.25rem;
  background: var(--bg-tertiary);
  border-top: 1px solid var(--border);
  display: flex;
  gap: 0.75rem;
}

.feature-card-footer button {
  display: flex;
  align-items: center;
  gap: 0.375rem;
}

.empty-state {
  text-align: center;
  padding: 3rem 2rem;
  background: var(--bg-secondary);
  border: 1px dashed var(--border);
  border-radius: 0.75rem;
}

.empty-icon {
  font-size: 3rem;
  margin-bottom: 1rem;
}

.empty-state h4 {
  margin: 0 0 0.5rem 0;
  font-size: 1.125rem;
}

.empty-state p {
  margin: 0 0 1.5rem 0;
  color: var(--text-secondary);
}

.run-section h3 {
  margin: 0 0 1rem 0;
  font-size: 1.125rem;
}

.run-card {
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: 0.75rem;
  padding: 1.5rem;
}

.help-text {
  margin: 0 0 1rem 0;
  color: var(--text-secondary);
  font-size: 0.875rem;
}

.feature-selector {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  margin-bottom: 1.5rem;
  max-height: 250px;
  overflow-y: auto;
  padding-right: 0.5rem;
}

.feature-checkbox {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.875rem 1rem;
  background: var(--bg-tertiary);
  border: 1px solid var(--border);
  border-radius: 0.5rem;
  transition: all 0.2s;
}

.feature-checkbox:hover {
  border-color: var(--accent);
  background: var(--bg-secondary);
}

.feature-checkbox input[type="checkbox"] {
  display: none;
}

.checkbox-label {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex: 1;
  cursor: pointer;
}

.checkbox-check {
  width: 20px;
  height: 20px;
  border: 2px solid var(--border);
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
  flex-shrink: 0;
}

.feature-checkbox input:checked + .checkbox-check {
  background: var(--accent);
  border-color: var(--accent);
}

.feature-checkbox input:checked + .checkbox-check::after {
  content: '✓';
  color: white;
  font-size: 0.75rem;
  font-weight: bold;
}

.checkbox-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
}

.checkbox-name {
  font-weight: 500;
}

.checkbox-meta {
  font-size: 0.75rem;
  color: var(--text-secondary);
}

.run-actions {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-top: 1rem;
  border-top: 1px solid var(--border);
}

/* Drag handle */
.drag-handle {
  cursor: grab;
  color: var(--text-secondary);
  font-size: 0.875rem;
  letter-spacing: -2px;
  padding: 0 0.25rem;
  user-select: none;
}

.drag-handle:active {
  cursor: grabbing;
}

.feature-checkbox[draggable="true"] {
  cursor: move;
}

.feature-checkbox .checkbox-label {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex: 1;
  cursor: pointer;
}

/* Options checkboxes */
.run-options {
  display: flex;
  gap: 1.5rem;
  margin-bottom: 1rem;
  padding: 0.75rem 1rem;
  background: var(--bg-tertiary);
  border-radius: 0.5rem;
}

.option-checkbox {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  cursor: pointer;
  font-size: 0.875rem;
}

.option-checkbox input[type="checkbox"] {
  display: none;
}

.option-check {
  width: 18px;
  height: 18px;
  border: 2px solid var(--border);
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
  flex-shrink: 0;
}

.option-checkbox input:checked + .option-check {
  background: var(--accent);
  border-color: var(--accent);
}

.option-checkbox input:checked + .option-check::after {
  content: '✓';
  color: white;
  font-size: 0.7rem;
  font-weight: bold;
}

.run-summary {
  color: var(--text-secondary);
  font-size: 0.875rem;
}

.btn-large {
  padding: 0.75rem 1.5rem;
  font-size: 1rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

/* Modal */
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 1rem;
}

.modal {
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: 0.75rem;
  max-height: 90vh;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  width: 100%;
}

.modal form {
  display: flex;
  flex-direction: column;
  flex: 1 1 auto;
  overflow: hidden;
  min-height: 0;
}

.modal-small {
  max-width: 400px;
}

.modal-large {
  max-width: 700px;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1.25rem 1.5rem;
  border-bottom: 1px solid var(--border);
}

.modal-header h3 {
  margin: 0;
  font-size: 1.125rem;
}

.btn-icon {
  background: none;
  border: none;
  font-size: 1.25rem;
  color: var(--text-secondary);
  padding: 0.25rem;
  width: auto;
}

.btn-icon:hover {
  color: var(--text-primary);
}

.modal-body {
  padding: 1.5rem;
  overflow-y: auto;
  flex: 1 1 auto;
  min-height: 0;
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
  padding: 1rem 1.5rem;
  border-top: 1px solid var(--border);
}

.modal-body p {
  margin-bottom: 1rem;
}

.warning {
  color: var(--error);
  font-size: 0.875rem;
}

.gherkin-editor {
  display: grid;
  grid-template-columns: 1fr 180px;
  gap: 1rem;
}

.gherkin-editor textarea {
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  font-size: 0.875rem;
  line-height: 1.6;
  resize: vertical;
}

.gherkin-help {
  font-size: 0.75rem;
  color: var(--text-secondary);
  padding: 0.875rem;
  background: var(--bg-tertiary);
  border-radius: 0.5rem;
}

.gherkin-help h4 {
  margin: 0 0 0.75rem 0;
  font-size: 0.875rem;
}

.syntax-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.5rem;
}

.syntax-item code {
  background: var(--bg-secondary);
  padding: 0.125rem 0.375rem;
  border-radius: 0.25rem;
  font-family: monospace;
  font-size: 0.75rem;
}

.form-group label.form-label {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.form-group input[type="checkbox"] {
  width: auto;
}

/* Boiler Plate Section */
.boilerplate-section {
  margin-bottom: 1rem;
}

.boilerplate-header {
  display: flex;
  align-items: center;
  gap: 1rem;
  margin-bottom: 0.5rem;
}

.selected-template {
  font-size: 0.875rem;
  color: var(--text-secondary);
  background: var(--bg-tertiary);
  padding: 0.25rem 0.75rem;
  border-radius: 0.375rem;
}

.boilerplate-menu {
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: 0.75rem;
  padding: 1rem;
  margin-top: 0.5rem;
  max-height: 400px;
  overflow-y: auto;
}

.boilerplate-category {
  margin-bottom: 1rem;
}

.boilerplate-category:last-child {
  margin-bottom: 0;
}

.boilerplate-category h5 {
  margin: 0 0 0.75rem 0;
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--accent);
  padding-bottom: 0.5rem;
  border-bottom: 1px solid var(--border);
}

.boilerplate-templates {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 0.75rem;
}

.boilerplate-btn {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem 1rem;
  background: var(--bg-tertiary);
  border: 1px solid var(--border);
  border-radius: 0.5rem;
  cursor: pointer;
  transition: all 0.2s;
  text-align: left;
  width: 100%;
}

.boilerplate-btn:hover {
  border-color: var(--accent);
  background: var(--bg-secondary);
  transform: translateY(-1px);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
}

.template-icon {
  font-size: 1.5rem;
  flex-shrink: 0;
}

.template-name {
  font-weight: 500;
  font-size: 0.875rem;
  color: var(--text-primary);
}

.template-desc {
  display: block;
  font-size: 0.75rem;
  color: var(--text-secondary);
  margin-top: 0.125rem;
}

/* AI Generator */
.ai-generator {
  background: linear-gradient(135deg, rgba(59, 130, 246, 0.1) 0%, rgba(139, 92, 246, 0.1) 100%);
  border: 1px solid rgba(59, 130, 246, 0.3);
  border-radius: 0.75rem;
  padding: 1rem;
  margin-bottom: 1rem;
}

.ai-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.75rem;
}

.ai-header .form-label {
  margin: 0;
  display: flex;
  align-items: center;
  gap: 0.375rem;
}

.ai-generator textarea {
  background: var(--bg-primary);
  border: 1px solid var(--border);
  resize: vertical;
}

.steps-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
  gap: 1rem;
}

.step-card {
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: 0.5rem;
  overflow: hidden;
  transition: all 0.2s;
}

.step-card:hover {
  border-color: var(--accent);
}

.step-header {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.875rem 1rem;
  border-bottom: 1px solid var(--border);
}

.step-icon {
  font-size: 1.25rem;
}

.step-info {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.step-name {
  font-weight: 500;
  font-size: 0.875rem;
}

.step-actions {
  display: flex;
  gap: 0.25rem;
}

.step-body {
  padding: 0.75rem 1rem;
}

.gherkin-pattern {
  display: block;
  background: var(--bg-tertiary);
  padding: 0.5rem 0.75rem;
  border-radius: 0.375rem;
  font-family: 'Monaco', 'Menlo', monospace;
  font-size: 0.75rem;
  color: var(--accent);
  margin-bottom: 0.5rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.step-meta {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 0.75rem;
  color: var(--text-secondary);
}

.function {
  font-family: monospace;
  background: var(--bg-tertiary);
  padding: 0.125rem 0.375rem;
  border-radius: 0.25rem;
}

/* Parameters Editor */
.params-editor {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.param-row {
  display: grid;
  grid-template-columns: 2fr 1fr 2fr auto;
  gap: 0.5rem;
  align-items: center;
}

.param-row input,
.param-row select {
  padding: 0.5rem;
  border: 1px solid var(--border);
  border-radius: 0.375rem;
  background: var(--bg-primary);
  font-size: 0.875rem;
}

/* Badge colors */
.badge-purple { background: #8b5cf6; color: white; }
.badge-orange { background: #f97316; color: white; }
.badge-teal { background: #14b8a6; color: white; }
.badge-dark { background: #374151; color: white; }
.badge-pink { background: #ec4899; color: white; }
.badge-primary { background: #3b82f6; color: white; }

/* Gherkin Sidebar */
.gherkin-sidebar {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  max-height: 500px;
  overflow-y: auto;
}

/* Step Library Search */
.step-library-search {
  position: sticky;
  top: 0;
  background: var(--bg-secondary);
  z-index: 10;
  padding: 0.5rem 0;
}

.search-input {
  width: 100%;
  padding: 0.5rem 0.75rem;
  border: 1px solid var(--border);
  border-radius: 0.375rem;
  background: var(--bg-primary);
  font-size: 0.8rem;
  color: var(--text-primary);
}

.search-input:focus {
  outline: none;
  border-color: var(--accent);
}

/* Step Library */
.step-library {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.step-category {
  background: var(--bg-tertiary);
  border-radius: 0.5rem;
  overflow: hidden;
}

.step-category h5 {
  margin: 0;
  padding: 0.5rem 0.75rem;
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--text-secondary);
  cursor: pointer;
  user-select: none;
  display: flex;
  align-items: center;
  gap: 0.375rem;
  background: var(--bg-secondary);
  transition: background 0.2s;
}

.step-category h5:hover {
  background: var(--bg-tertiary);
}

.category-icon {
  font-size: 0.65rem;
  transition: transform 0.2s;
}

.step-category h5.collapsed .category-icon {
  transform: rotate(-90deg);
}

.step-list {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  padding: 0.5rem;
  max-height: 300px;
  overflow-y: auto;
}

.step-library-item {
  padding: 0.5rem;
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: 0.375rem;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.step-library-item:hover {
  border-color: var(--accent);
  background: linear-gradient(135deg, rgba(59, 130, 246, 0.08) 0%, rgba(139, 92, 246, 0.08) 100%);
}

.step-pattern {
  display: block;
  font-family: 'Monaco', 'Menlo', monospace;
  font-size: 0.7rem;
  color: var(--accent);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.step-desc {
  font-size: 0.65rem;
  color: var(--text-secondary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* Step Builder */
.step-builder {
  background: var(--bg-tertiary);
  padding: 0.75rem;
  border-radius: 0.5rem;
}

.step-builder h4 {
  margin: 0 0 0.5rem 0;
  font-size: 0.75rem;
  color: var(--text-secondary);
}

/* .step-select is defined in the Steps List section below */

.step-params {
  margin: 0.5rem 0;
}

.param-label {
  display: block;
  font-size: 0.7rem;
  color: var(--text-secondary);
  margin-bottom: 0.25rem;
}

.param-input {
  width: 100%;
  padding: 0.4rem;
  border: 1px solid var(--border);
  border-radius: 0.25rem;
  background: var(--bg-primary);
  font-size: 0.75rem;
  margin-bottom: 0.25rem;
}

/* Validation messages */
.error-text {
  color: var(--error);
  font-size: 0.75rem;
  margin-left: 0.5rem;
}

.success-text {
  color: #10b981;
  font-size: 0.75rem;
  margin-left: 0.5rem;
}

/* Modal XL - Extra Large */
.modal-xl {
  max-width: 1200px;
  width: 95%;
}

/* Modal XXL - Extra Extra Large */
.modal-xxl {
  max-width: 95vw;
  width: 95%;
  height: 90vh;
}

/* Step Builder Section */
.step-builder-section {
  background: var(--bg-tertiary);
  border: 1px solid var(--border);
  border-radius: 0.5rem;
  padding: 1rem;
  margin-bottom: 1rem;
}

.step-builder-controls {
  display: flex;
  gap: 0.75rem;
  margin-bottom: 1rem;
}

.step-builder-controls .step-select {
  flex: 1;
}

/* Selected Step Card */
.selected-step-card {
  background: var(--bg-secondary);
  border: 1px solid var(--accent);
  border-radius: 0.5rem;
  padding: 1rem;
  margin-top: 1rem;
}

.step-pattern-preview {
  margin-bottom: 0.5rem;
}

.step-pattern-preview code {
  display: block;
  background: var(--bg-tertiary);
  padding: 0.5rem;
  border-radius: 0.25rem;
  font-size: 0.75rem;
  margin-top: 0.25rem;
}

.step-desc {
  color: var(--text-secondary);
  font-size: 0.8rem;
  margin-bottom: 1rem;
}

.step-params-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 0.75rem;
  margin-bottom: 1rem;
}

.param-field {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.param-field label {
  font-size: 0.75rem;
  color: var(--text-secondary);
}

.step-preview-result {
  background: var(--bg-primary);
  border: 1px solid var(--border);
  border-radius: 0.375rem;
  padding: 0.75rem;
  margin-bottom: 1rem;
}

.step-preview-result strong {
  display: block;
  font-size: 0.75rem;
  margin-bottom: 0.25rem;
}

.preview-code {
  display: block;
  color: var(--accent);
  font-family: monospace;
  font-size: 0.85rem;
}

/* Validation Errors */
.validation-errors {
  background: rgba(239, 68, 68, 0.1);
  border: 1px solid rgba(239, 68, 68, 0.3);
  border-radius: 0.5rem;
  padding: 0.75rem;
  margin-bottom: 1rem;
}

.validation-errors h4 {
  margin: 0 0 0.5rem 0;
  font-size: 0.75rem;
  color: var(--error);
}

.error-item {
  font-size: 0.7rem;
  color: var(--error);
  padding: 0.25rem 0;
  word-break: break-word;
}

/* Valid Steps */
.valid-steps {
  background: rgba(16, 185, 129, 0.1);
  border: 1px solid rgba(16, 185, 129, 0.3);
  border-radius: 0.5rem;
  padding: 0.75rem;
}

.valid-steps h4 {
  margin: 0 0 0.5rem 0;
  font-size: 0.75rem;
  color: #10b981;
}

.valid-item {
  font-size: 0.7rem;
  color: var(--text-secondary);
  padding: 0.15rem 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.more-count {
  font-size: 0.7rem;
  color: var(--text-secondary);
  padding: 0.25rem 0;
}

/* Editor Toggle */
.editor-toggle {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 1rem;
  border-bottom: 1px solid var(--border);
  padding-bottom: 0.5rem;
}

.tab-btn {
  padding: 0.5rem 1rem;
  border: none;
  background: none;
  cursor: pointer;
  border-radius: 0.375rem 0.375rem 0 0;
  font-size: 0.875rem;
  color: var(--text-secondary);
  transition: all 0.2s;
}

.tab-btn.active {
  background: var(--bg-tertiary);
  color: var(--text-primary);
  font-weight: 500;
}

.tab-btn:hover:not(.active) {
  background: var(--bg-tertiary);
}

/* Appium Server Status */
.appium-status-section {
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: 0.75rem;
  padding: 1.5rem;
}

.status-badge {
  padding: 0.375rem 0.75rem;
  border-radius: 0.375rem;
  font-size: 0.875rem;
  font-weight: 500;
}

.status-connected {
  background: rgba(16, 185, 129, 0.15);
  color: #10b981;
}

.status-disconnected {
  background: rgba(239, 68, 68, 0.15);
  color: #ef4444;
}

.appium-config {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  margin-bottom: 1rem;
  padding: 1rem;
  background: var(--bg-tertiary);
  border-radius: 0.5rem;
}

.config-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.config-label {
  font-weight: 500;
  color: var(--text-secondary);
  min-width: 80px;
}

.config-value {
  font-family: monospace;
  color: var(--text-primary);
}

.appium-warning {
  padding: 1rem;
  background: rgba(239, 68, 68, 0.1);
  border: 1px solid rgba(239, 68, 68, 0.3);
  border-radius: 0.5rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
}

.appium-warning p {
  margin: 0;
  color: var(--text-primary);
}

.appium-success {
  padding: 1rem;
  background: rgba(16, 185, 129, 0.1);
  border: 1px solid rgba(16, 185, 129, 0.3);
  border-radius: 0.5rem;
}

.appium-success p {
  margin: 0;
  color: #10b981;
}
</style>
