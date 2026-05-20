/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type React from 'react';
import { useState, useEffect } from 'react';
import {
  AuthType,
  CodingPlanRegion,
  isCodingPlanConfig,
} from '@qwen-code/qwen-code-core';
import { Box, Text } from 'ink';
import Link from 'ink-link';
import { theme } from '../semantic-colors.js';
import { useKeypress } from '../hooks/useKeypress.js';
import { DescriptiveRadioButtonSelect } from '../components/shared/DescriptiveRadioButtonSelect.js';
import {
  ApiKeyInput,
  CODING_PLAN_API_KEY_URL,
  CODING_PLAN_INTL_API_KEY_URL,
} from '../components/ApiKeyInput.js';
import { TextInput } from '../components/shared/TextInput.js';
import { useUIState } from '../contexts/UIStateContext.js';
import { useUIActions } from '../contexts/UIActionsContext.js';
import { useConfig } from '../contexts/ConfigContext.js';
import { t } from '../../i18n/index.js';
import {
  ALIBABA_STANDARD_API_KEY_ENDPOINTS,
  type AlibabaStandardRegion,
} from '../../constants/alibabaStandardApiKey.js';
import {
  generateCustomApiKeyEnvKey,
  normalizeCustomModelIds,
  maskApiKey,
} from './useAuth.js';

const MODEL_PROVIDERS_DOCUMENTATION_URL =
  'https://qwenlm.github.io/qwen-code-docs/en/users/configuration/model-providers/';

function parseDefaultAuthType(
  defaultAuthType: string | undefined,
): AuthType | null {
  if (
    defaultAuthType &&
    Object.values(AuthType).includes(defaultAuthType as AuthType)
  ) {
    return defaultAuthType as AuthType;
  }
  return null;
}

// Main menu option type
type MainOption =
  | typeof AuthType.QWEN_OAUTH
  | typeof AuthType.USE_LM_STUDIO
  | typeof AuthType.USE_OLLAMA
  | 'CODING_PLAN'
  | 'API_KEY'
  | 'LOGOUT'
  | 'OAUTH';
type ApiKeyOption =
  | 'OPENROUTER_OAUTH'
  | 'ALIBABA_STANDARD_API_KEY'
  | 'CUSTOM_API_KEY';
type OAuthOption =
  | 'OPENROUTER_OAUTH'
  | 'MODELSCOPE_OAUTH'
  | 'QWEN_OAUTH_DISCONTINUED';

// View level for navigation
type ViewLevel =
  | 'main'
  | 'region-select'
  | 'api-key-input'
  | 'api-key-type-select'
  | 'alibaba-standard-region-select'
  | 'alibaba-standard-api-key-input'
  | 'alibaba-standard-model-id-input'
  | 'custom-protocol-select'
  | 'custom-base-url-input'
  | 'custom-api-key-input'
  | 'custom-model-id-input'
  | 'custom-advanced-config'
  | 'custom-review-json'
  | 'oauth-provider-select'
  | 'lm-studio-input'
  | 'ollama-input'
  | 'ollama-models';

const ALIBABA_STANDARD_MODEL_IDS_PLACEHOLDER = 'qwen3.5-plus,glm-5,kimi-k2.5';
const ALIBABA_STANDARD_API_DOCUMENTATION_URLS: Record<
  AlibabaStandardRegion,
  string
> = {
  'cn-beijing': 'https://bailian.console.aliyun.com/cn-beijing?tab=api#/api',
  'sg-singapore':
    'https://modelstudio.console.alibabacloud.com/ap-southeast-1?tab=api#/api/?type=model&url=2712195',
  'us-virginia':
    'https://modelstudio.console.alibabacloud.com/us-east-1?tab=api#/api/?type=model&url=2712195',
  'cn-hongkong':
    'https://modelstudio.console.alibabacloud.com/cn-hongkong?tab=api#/api/?type=model&url=2712195',
};

export function AuthDialog(): React.JSX.Element {
  const {
    auth: { pendingAuthType, authError },
  } = useUIState();
  const {
    auth: {
      handleAuthSelect: onAuthSelect,
      handleCodingPlanSubmit,
      handleAlibabaStandardSubmit,
      handleOpenRouterSubmit,
      handleCustomApiKeySubmit,
      onAuthError,
    },
  } = useUIActions();
  const config = useConfig();
  const savedConfig = config.getContentGeneratorConfig();

  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [viewLevel, setViewLevel] = useState<ViewLevel>('main');
  const [regionIndex, setRegionIndex] = useState<number>(0);
  const [region, setRegion] = useState<CodingPlanRegion>(
    CodingPlanRegion.CHINA,
  );
  const [alibabaStandardRegionIndex, setAlibabaStandardRegionIndex] =
    useState<number>(0);
  const [apiKeyTypeIndex, setApiKeyTypeIndex] = useState<number>(0);
  const [oauthProviderIndex, setOAuthProviderIndex] = useState<number>(0);
  const [alibabaStandardRegion, setAlibabaStandardRegion] =
    useState<AlibabaStandardRegion>('cn-beijing');
  const [alibabaStandardApiKey, setAlibabaStandardApiKey] = useState('');
  const [alibabaStandardApiKeyError, setAlibabaStandardApiKeyError] = useState<
    string | null
  >(null);
  const [alibabaStandardModelId, setAlibabaStandardModelId] = useState('');
  const [alibabaStandardModelIdError, setAlibabaStandardModelIdError] =
    useState<string | null>(null);

  // Custom API Key wizard state
  const [customProtocolIndex, setCustomProtocolIndex] = useState<number>(0);
  const [customProtocol, setCustomProtocol] = useState<AuthType>(
    AuthType.USE_OPENAI,
  );
  const [customBaseUrl, setCustomBaseUrl] = useState('');
  const [customBaseUrlError, setCustomBaseUrlError] = useState<string | null>(
    null,
  );
  const [customApiKey, setCustomApiKey] = useState('');
  const [customApiKeyError, setCustomApiKeyError] = useState<string | null>(
    null,
  );
  const [customModelIds, setCustomModelIds] = useState('');
  const [customModelIdsError, setCustomModelIdsError] = useState<string | null>(
    null,
  );

  // Advanced generation config state
  const [advancedThinkingEnabled, setAdvancedThinkingEnabled] = useState(false);
  const [advancedModalityEnabled, setAdvancedModalityEnabled] = useState(false);
  const [focusedConfigIndex, setFocusedConfigIndex] = useState(0);
  // 0 = thinking, 1 = modality

  // LM Sutdio & Ollama Local LLM
  const [lmStudioBaseUrl, setLmStudioBaseUrl] = useState<string>(
    savedConfig?.baseUrl?.includes('1234')
      ? savedConfig.baseUrl
      : 'http://localhost:1234/v1',
  );
  const [lmStudioApiKey, setLmStudioApiKey] = useState<string>(
    savedConfig?.apiKey || '',
  );
  const [lmStudioStep, setLmStudioStep] = useState<'baseUrl' | 'apiKey'>(
    'baseUrl',
  );
  const [ollamaBaseUrl, setOllamaBaseUrl] = useState<string>(
    savedConfig?.baseUrl?.includes('11434')
      ? savedConfig.baseUrl
      : 'http://localhost:11434/v1',
  );
  const [ollamaApiKey, setOllamaApiKey] = useState<string>(
    savedConfig?.apiKey || '',
  );
  const [ollamaStep, setOllamaStep] = useState<'baseUrl' | 'apiKey' | 'models'>(
    'baseUrl',
  );
  const [ollamaModels, setOllamaModels] = useState<string[]>([]);
  const [loadingOllamaModels, setLoadingOllamaModels] =
    useState<boolean>(false);
  const [selectedOllamaModel, setSelectedOllamaModel] = useState<string>(
    savedConfig?.model || '',
  );

  useEffect(() => {
    const currentAuthType = config.getAuthType();
    const contentGenConfig = config.getContentGeneratorConfig();

    if (currentAuthType === AuthType.USE_LM_STUDIO && contentGenConfig) {
      if (contentGenConfig.baseUrl) {
        setLmStudioBaseUrl(contentGenConfig.baseUrl);
      }
      if (contentGenConfig.apiKey) {
        setLmStudioApiKey(contentGenConfig.apiKey);
      }
    }

    if (currentAuthType === AuthType.USE_OLLAMA && contentGenConfig) {
      if (contentGenConfig.baseUrl) {
        setOllamaBaseUrl(contentGenConfig.baseUrl);
      }
      if (contentGenConfig.apiKey) {
        setOllamaApiKey(contentGenConfig.apiKey);
      }
      if (contentGenConfig.model) {
        setSelectedOllamaModel(contentGenConfig.model);
      }
    }
  }, [config]);

  // Main authentication entries (flat three-option layout)
  const mainItems: Array<{
    key: string;
    title: string;
    label: string;
    description: string | React.ReactNode;
    value: MainOption;
  }> = [
    {
      key: 'CODING_PLAN',
      title: t('Alibaba Cloud Coding Plan'),
      label: t('Alibaba Cloud Coding Plan'),
      description: t(
        'Paid \u00B7 Up to 6,000 requests/5 hrs \u00B7 All Alibaba Cloud Coding Plan Models',
      ),
      value: 'CODING_PLAN',
    },
    {
      key: 'API_KEY',
      title: t('API Key'),
      label: t('API Key'),
      description: t('Bring your own API key'),
      value: 'API_KEY',
    },
    {
      key: AuthType.USE_LM_STUDIO,
      title: t('LM Studio'),
      label: t('LM Studio'),
      description: t(
        'Local \u00B7 No API key required \u00B7 Run models on your machine',
      ),
      value: AuthType.USE_LM_STUDIO,
    },
    {
      key: AuthType.USE_OLLAMA,
      title: t('Ollama'),
      label: t('Ollama'),
      description: t(
        'Local \u00B7 No API key required \u00B7 Run models on your machine',
      ),
      value: AuthType.USE_OLLAMA,
    },
    {
      key: 'LOGOUT',
      title: t('Logout'),
      label: t('Logout'),
      description: t('Clear current login and credentials'),
      value: 'LOGOUT',
    },
    {
      key: 'OAUTH',
      title: t('OAuth'),
      label: t('OAuth'),
      description: t(
        'Browser-based authentication with third-party providers (e.g. OpenRouter, ModelScope)',
      ),
      value: 'OAUTH' as MainOption,
    },
  ];

  // Region selection entries (shown after selecting Alibaba Cloud Coding Plan)
  const regionItems = [
    {
      key: 'china',
      title: '阿里云百炼 (aliyun.com)',
      label: '阿里云百炼 (aliyun.com)',
      description: (
        <Link
          url="https://help.aliyun.com/zh/model-studio/coding-plan"
          fallback={false}
        >
          <Text color={theme.text.secondary}>
            https://help.aliyun.com/zh/model-studio/coding-plan
          </Text>
        </Link>
      ),
      value: CodingPlanRegion.CHINA,
    },
    {
      key: 'global',
      title: 'Alibaba Cloud (alibabacloud.com)',
      label: 'Alibaba Cloud (alibabacloud.com)',
      description: (
        <Link
          url="https://www.alibabacloud.com/help/en/model-studio/coding-plan"
          fallback={false}
        >
          <Text color={theme.text.secondary}>
            https://www.alibabacloud.com/help/en/model-studio/coding-plan
          </Text>
        </Link>
      ),
      value: CodingPlanRegion.GLOBAL,
    },
  ];

  const alibabaStandardRegionItems = [
    {
      key: 'cn-beijing',
      title: t('China (Beijing)'),
      label: t('China (Beijing)'),
      description: (
        <Text color={theme.text.secondary}>
          Endpoint: {ALIBABA_STANDARD_API_KEY_ENDPOINTS['cn-beijing']}
        </Text>
      ),
      value: 'cn-beijing' as AlibabaStandardRegion,
    },
    {
      key: 'sg-singapore',
      title: t('Singapore'),
      label: t('Singapore'),
      description: (
        <Text color={theme.text.secondary}>
          Endpoint: {ALIBABA_STANDARD_API_KEY_ENDPOINTS['sg-singapore']}
        </Text>
      ),
      value: 'sg-singapore' as AlibabaStandardRegion,
    },
    {
      key: 'us-virginia',
      title: t('US (Virginia)'),
      label: t('US (Virginia)'),
      description: (
        <Text color={theme.text.secondary}>
          Endpoint: {ALIBABA_STANDARD_API_KEY_ENDPOINTS['us-virginia']}
        </Text>
      ),
      value: 'us-virginia' as AlibabaStandardRegion,
    },
    {
      key: 'cn-hongkong',
      title: t('China (Hong Kong)'),
      label: t('China (Hong Kong)'),
      description: (
        <Text color={theme.text.secondary}>
          Endpoint: {ALIBABA_STANDARD_API_KEY_ENDPOINTS['cn-hongkong']}
        </Text>
      ),
      value: 'cn-hongkong' as AlibabaStandardRegion,
    },
  ];

  const protocolItems = [
    {
      key: AuthType.USE_OPENAI,
      title: t('OpenAI-compatible'),
      label: t('OpenAI-compatible'),
      description: t(
        'OpenAI Chat Completions API (OpenRouter, vLLM, Ollama, LM Studio, Fireworks, etc.)',
      ),
      value: AuthType.USE_OPENAI as AuthType,
    },
    {
      key: AuthType.USE_ANTHROPIC,
      title: t('Anthropic-compatible'),
      label: t('Anthropic-compatible'),
      description: t('Anthropic Messages API'),
      value: AuthType.USE_ANTHROPIC as AuthType,
    },
    {
      key: AuthType.USE_GEMINI,
      title: t('Gemini-compatible'),
      label: t('Gemini-compatible'),
      description: t('Google Gemini API'),
      value: AuthType.USE_GEMINI as AuthType,
    },
  ];

  const DEFAULT_CUSTOM_BASE_URLS: Partial<Record<AuthType, string>> = {
    [AuthType.USE_OPENAI]: 'https://api.openai.com/v1',
    [AuthType.USE_ANTHROPIC]: 'https://api.anthropic.com/v1',
    [AuthType.USE_GEMINI]: 'https://generativelanguage.googleapis.com',
  };

  const apiKeyTypeItems = [
    {
      key: 'ALIBABA_STANDARD_API_KEY',
      title: t('Alibaba Cloud ModelStudio Standard API Key'),
      label: t('Alibaba Cloud ModelStudio Standard API Key'),
      description: t('Quick setup for Model Studio (China/International)'),
      value: 'ALIBABA_STANDARD_API_KEY' as ApiKeyOption,
    },
    {
      key: 'CUSTOM_API_KEY',
      title: t('Custom API Key'),
      label: t('Custom API Key'),
      description: t(
        'For other OpenAI / Anthropic / Gemini-compatible providers',
      ),
      value: 'CUSTOM_API_KEY' as ApiKeyOption,
    },
  ];

  const oauthProviderItems = [
    {
      key: 'OPENROUTER_OAUTH',
      title: t('OpenRouter'),
      label: t('OpenRouter'),
      description: t(
        'Browser OAuth · Auto-configure API key and OpenRouter models',
      ),
      value: 'OPENROUTER_OAUTH' as OAuthOption,
    },
    {
      key: 'MODELSCOPE_OAUTH',
      title: t('ModelScope'),
      label: t('ModelScope'),
      description: t(
        'Browser OAuth · Auto-configure API key and ModelScope models',
      ),
      value: 'MODELSCOPE_OAUTH' as OAuthOption,
    },
    {
      key: 'QWEN_OAUTH_DISCONTINUED',
      title: t('Qwen'),
      label: t('Qwen'),
      description: t('Discontinued — switch to Coding Plan or API Key'),
      value: 'QWEN_OAUTH_DISCONTINUED' as OAuthOption,
    },
  ];

  // Map an AuthType to the corresponding main menu option.
  // QWEN_OAUTH maps to 'OAUTH'; USE_OPENAI maps to:
  // - CODING_PLAN when current config matches coding plan
  // - API_KEY for other OpenAI / Anthropic / Gemini-compatible configs
  const contentGenConfig = config.getContentGeneratorConfig();
  const isCurrentlyCodingPlan =
    isCodingPlanConfig(
      contentGenConfig?.baseUrl,
      contentGenConfig?.apiKeyEnvKey,
    ) !== false;
  const authTypeToMainOption = (authType: AuthType): MainOption => {
    if (authType === AuthType.QWEN_OAUTH) return 'OAUTH';
    if (authType === AuthType.USE_LM_STUDIO) return AuthType.USE_LM_STUDIO;
    if (authType === AuthType.USE_OLLAMA) return AuthType.USE_OLLAMA;
    if (authType === AuthType.USE_OPENAI && isCurrentlyCodingPlan) {
      return 'CODING_PLAN';
    }
    return 'API_KEY';
  };

  const initialAuthIndex = Math.max(
    0,
    mainItems.findIndex((item) => {
      // Priority 1: pendingAuthType
      if (pendingAuthType) {
        return item.value === authTypeToMainOption(pendingAuthType);
      }

      // Priority 2: config.getAuthType() - the source of truth
      const currentAuthType = config.getAuthType();
      if (currentAuthType) {
        return item.value === authTypeToMainOption(currentAuthType);
      }

      // Priority 3: QWEN_DEFAULT_AUTH_TYPE env var
      const defaultAuthType = parseDefaultAuthType(
        process.env['QWEN_DEFAULT_AUTH_TYPE'],
      );
      if (defaultAuthType) {
        return item.value === authTypeToMainOption(defaultAuthType);
      }

      // Priority 4: default to OAUTH
      return item.value === 'OAUTH';
    }),
  );

  const handleMainSelect = async (value: MainOption) => {
    setErrorMessage(null);
    onAuthError(null);

    if (value === 'CODING_PLAN') {
      // Navigate to region selection
      setViewLevel('region-select');
      return;
    }

    if (value === 'API_KEY') {
      setViewLevel('api-key-type-select');
      return;
    }

    if (value === 'OAUTH') {
      setViewLevel('oauth-provider-select');
      return;
    }

    if (value === AuthType.USE_LM_STUDIO) {
      setViewLevel('lm-studio-input');
      return;
    }

    if (value === AuthType.USE_OLLAMA) {
      setViewLevel('ollama-input');
      return;
    }

    if (value === 'LOGOUT') {
      await onAuthSelect(undefined);
      return;
    }

    await onAuthSelect(value);
  };

  const handleApiKeyTypeSelect = async (value: ApiKeyOption) => {
    setErrorMessage(null);
    onAuthError(null);

    if (value === 'ALIBABA_STANDARD_API_KEY') {
      setAlibabaStandardModelIdError(null);
      setAlibabaStandardApiKeyError(null);
      setViewLevel('alibaba-standard-region-select');
      return;
    }

    // Reset custom wizard state and go to protocol selection
    setCustomProtocolIndex(0);
    setCustomProtocol(AuthType.USE_OPENAI);
    setCustomBaseUrl('');
    setCustomBaseUrlError(null);
    setCustomApiKey('');
    setCustomApiKeyError(null);
    setCustomModelIds('');
    setCustomModelIdsError(null);
    setAdvancedThinkingEnabled(false);
    setAdvancedModalityEnabled(false);
    setFocusedConfigIndex(0);
    setViewLevel('custom-protocol-select');
  };

  const handleOAuthProviderSelect = async (value: OAuthOption) => {
    setErrorMessage(null);
    onAuthError(null);

    if (value === 'OPENROUTER_OAUTH') {
      await handleOpenRouterSubmit();
      return;
    }

    // Qwen OAuth free tier discontinued — show warning instead of proceeding
    if (value === 'QWEN_OAUTH_DISCONTINUED') {
      setErrorMessage(
        t(
          'Qwen OAuth free tier was discontinued on 2026-04-15. Please select Coding Plan or API Key instead.',
        ),
      );
      return;
    }

    // Future: Add support for ModelScope OAuth when implemented
    if (value === 'MODELSCOPE_OAUTH') {
      // Currently not implemented, show message
      setErrorMessage(
        t(
          'ModelScope OAuth is not yet implemented. Please select another option.',
        ),
      );
      return;
    }

    // For other OAuth providers, you can extend the functionality here
    await onAuthSelect(AuthType.USE_OPENAI);
  };

  const handleRegionSelect = async (selectedRegion: CodingPlanRegion) => {
    setErrorMessage(null);
    onAuthError(null);
    setRegion(selectedRegion);
    setViewLevel('api-key-input');
  };

  const handleAlibabaStandardRegionSelect = async (
    selectedRegion: AlibabaStandardRegion,
  ) => {
    setErrorMessage(null);
    onAuthError(null);
    setAlibabaStandardApiKeyError(null);
    setAlibabaStandardModelIdError(null);
    setAlibabaStandardRegion(selectedRegion);
    setViewLevel('alibaba-standard-api-key-input');
  };

  const handleApiKeyInputSubmit = async (apiKey: string) => {
    setErrorMessage(null);

    if (!apiKey.trim()) {
      setErrorMessage(t('API key cannot be empty.'));
      return;
    }

    // Submit to parent for processing with region info
    await handleCodingPlanSubmit(apiKey, region);
  };

  const handleAlibabaStandardApiKeySubmit = () => {
    const trimmedKey = alibabaStandardApiKey.trim();
    if (!trimmedKey) {
      setAlibabaStandardApiKeyError(t('API key cannot be empty.'));
      return;
    }

    setAlibabaStandardApiKeyError(null);
    if (!alibabaStandardModelId.trim()) {
      setAlibabaStandardModelId(ALIBABA_STANDARD_MODEL_IDS_PLACEHOLDER);
    }
    setViewLevel('alibaba-standard-model-id-input');
  };

  const handleAlibabaStandardModelSubmit = () => {
    const trimmedApiKey = alibabaStandardApiKey.trim();
    const trimmedModelIds = alibabaStandardModelId.trim();
    if (!trimmedApiKey) {
      setAlibabaStandardApiKeyError(t('API key cannot be empty.'));
      setViewLevel('alibaba-standard-api-key-input');
      return;
    }
    if (!trimmedModelIds) {
      setAlibabaStandardModelIdError(t('Model IDs cannot be empty.'));
      return;
    }

    setAlibabaStandardModelIdError(null);
    void handleAlibabaStandardSubmit(
      trimmedApiKey,
      alibabaStandardRegion,
      trimmedModelIds,
    );
  };

  const handleCustomProtocolSelect = (protocol: AuthType) => {
    setErrorMessage(null);
    onAuthError(null);
    setCustomProtocol(protocol);
    const defaultUrl = DEFAULT_CUSTOM_BASE_URLS[protocol] ?? '';
    setCustomBaseUrl(defaultUrl);
    setCustomBaseUrlError(null);
    setViewLevel('custom-base-url-input');
  };

  const handleCustomBaseUrlSubmit = () => {
    const trimmedUrl = customBaseUrl.trim();
    if (!trimmedUrl) {
      setCustomBaseUrlError(t('Base URL cannot be empty.'));
      return;
    }
    if (!/^https?:\/\//i.test(trimmedUrl)) {
      setCustomBaseUrlError(t('Base URL must start with http:// or https://.'));
      return;
    }
    setCustomBaseUrlError(null);
    setCustomApiKey('');
    setCustomApiKeyError(null);
    setViewLevel('custom-api-key-input');
  };

  const handleCustomApiKeySubmitLocal = () => {
    const trimmedKey = customApiKey.trim();
    if (!trimmedKey) {
      setCustomApiKeyError(t('API key cannot be empty.'));
      return;
    }
    setCustomApiKeyError(null);
    setCustomModelIds('');
    setCustomModelIdsError(null);
    setViewLevel('custom-model-id-input');
  };

  const handleCustomModelIdSubmit = () => {
    const normalized = normalizeCustomModelIds(customModelIds);
    if (normalized.length === 0) {
      setCustomModelIdsError(t('Model IDs cannot be empty.'));
      return;
    }
    setCustomModelIdsError(null);
    setViewLevel('custom-advanced-config');
  };

  const handleAdvancedConfigSubmit = () => {
    setViewLevel('custom-review-json');
  };

  const handleCustomReviewSubmit = () => {
    const trimmedBaseUrl = customBaseUrl.trim();
    const trimmedApiKey = customApiKey.trim();
    const trimmedModelIds = customModelIds;

    // Build generationConfig only if any advanced option is set
    const hasThinking = advancedThinkingEnabled;
    const hasModality = advancedModalityEnabled;

    const generationConfig =
      hasThinking || hasModality
        ? {
            enableThinking: hasThinking ? true : undefined,
            multimodal: hasModality
              ? { image: true, video: true, audio: true }
              : undefined,
          }
        : undefined;

    void handleCustomApiKeySubmit(
      customProtocol as
        | AuthType.USE_OPENAI
        | AuthType.USE_ANTHROPIC
        | AuthType.USE_GEMINI,
      trimmedBaseUrl,
      trimmedApiKey,
      trimmedModelIds,
      generationConfig,
    );
  };

  // Handle LM Studio & Ollama LLM
  const handleLmStudioSubmit = async () => {
    setErrorMessage(null);

    if (!lmStudioApiKey.trim()) {
      setErrorMessage(t('API key cannot be empty.'));
      return;
    }

    await onAuthSelect(AuthType.USE_LM_STUDIO, {
      apiKey: lmStudioApiKey,
      baseUrl: lmStudioBaseUrl,
    });
  };

  const handleOllamaSubmit = async () => {
    setErrorMessage(null);
    setLoadingOllamaModels(true);

    try {
      const url = `${ollamaBaseUrl.replace('/v1', '')}/api/tags`;
      const response = await fetch(url, {
        method: 'GET',
        headers: ollamaApiKey
          ? { Authorization: `Bearer ${ollamaApiKey}` }
          : {},
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch models: ${response.status}`);
      }

      const data = await response.json();
      const models = (data.models || []).map((m: { name: string }) => m.name);

      if (models.length === 0) {
        setErrorMessage(t('No models found on Ollama server'));
        return;
      }

      setOllamaModels(models);
      setSelectedOllamaModel(models[0]);
      setOllamaStep('models');
    } catch (err) {
      setErrorMessage(
        t('Failed to connect to Ollama: {{error}}', {
          error: err instanceof Error ? err.message : 'Unknown error',
        }),
      );
    } finally {
      setLoadingOllamaModels(false);
    }
  };

  const handleOllamaModelSelect = async (model: string) => {
    await onAuthSelect(AuthType.USE_OLLAMA, {
      apiKey: ollamaApiKey,
      baseUrl: ollamaBaseUrl,
      model,
    });
  };

  const handleGoBack = () => {
    setErrorMessage(null);
    onAuthError(null);

    if (viewLevel === 'region-select') {
      setViewLevel('main');
    } else if (viewLevel === 'api-key-input') {
      setViewLevel('region-select');
    } else if (viewLevel === 'api-key-type-select') {
      setViewLevel('main');
    } else if (viewLevel === 'custom-protocol-select') {
      setViewLevel('api-key-type-select');
    } else if (viewLevel === 'custom-base-url-input') {
      setViewLevel('custom-protocol-select');
    } else if (viewLevel === 'custom-api-key-input') {
      setViewLevel('custom-base-url-input');
    } else if (viewLevel === 'custom-model-id-input') {
      setViewLevel('custom-api-key-input');
    } else if (viewLevel === 'custom-advanced-config') {
      setViewLevel('custom-model-id-input');
    } else if (viewLevel === 'custom-review-json') {
      setViewLevel('custom-advanced-config');
    } else if (viewLevel === 'alibaba-standard-region-select') {
      setViewLevel('api-key-type-select');
    } else if (viewLevel === 'alibaba-standard-api-key-input') {
      setViewLevel('alibaba-standard-region-select');
    } else if (viewLevel === 'alibaba-standard-model-id-input') {
      setViewLevel('alibaba-standard-api-key-input');
    } else if (viewLevel === 'oauth-provider-select') {
      setViewLevel('main');
    } else if (
      viewLevel === 'lm-studio-input' ||
      viewLevel === 'ollama-input' ||
      viewLevel === 'ollama-models'
    ) {
      setViewLevel('main');
      setLmStudioStep('baseUrl');
      setOllamaStep('baseUrl');
    }
  };

  useKeypress(
    (key) => {
      if (key.name === 'escape') {
        // Handle Escape based on current view level
        if (viewLevel === 'region-select') {
          handleGoBack();
          return;
        }

        if (viewLevel === 'api-key-input') {
          handleGoBack();
          return;
        }
        if (
          viewLevel === 'custom-protocol-select' ||
          viewLevel === 'custom-base-url-input' ||
          viewLevel === 'custom-api-key-input' ||
          viewLevel === 'custom-model-id-input' ||
          viewLevel === 'custom-advanced-config' ||
          viewLevel === 'custom-review-json'
        ) {
          handleGoBack();
          return;
        }
        if (
          viewLevel === 'api-key-type-select' ||
          viewLevel === 'alibaba-standard-region-select' ||
          viewLevel === 'alibaba-standard-api-key-input' ||
          viewLevel === 'alibaba-standard-model-id-input' ||
          viewLevel === 'oauth-provider-select'
        ) {
          handleGoBack();
          return;
        }

        // Handle LM Studio & Ollama selection
        if (viewLevel === 'lm-studio-input') {
          if (lmStudioStep === 'apiKey') {
            setLmStudioStep('baseUrl');
          } else {
            handleGoBack();
          }
          return;
        }

        if (viewLevel === 'ollama-input') {
          if (ollamaStep === 'models') {
            setOllamaStep('apiKey');
          } else if (ollamaStep === 'apiKey') {
            setOllamaStep('baseUrl');
          } else {
            handleGoBack();
          }
          return;
        }

        // For main view, use existing logic
        if (errorMessage) {
          return;
        }
        if (config.getAuthType() === undefined) {
          setErrorMessage(
            t(
              'You must select an auth method to proceed. Press Ctrl+C again to exit.',
            ),
          );
          return;
        }
        onAuthSelect(undefined);
      }
    },
    { isActive: true },
  );

  // Handle Enter key for review view to save
  useKeypress(
    (key) => {
      if (key.name === 'return' && viewLevel === 'custom-review-json') {
        handleCustomReviewSubmit();
      }
    },
    { isActive: true },
  );

  // Advanced config keypress: ↑↓ to navigate, Space to toggle, Enter to submit
  useKeypress(
    (key) => {
      if (viewLevel !== 'custom-advanced-config') return;

      const { name } = key;

      if (name === 'up') {
        setFocusedConfigIndex((v) => (v <= 0 ? 1 : v - 1));
        return;
      }

      if (name === 'down') {
        setFocusedConfigIndex((v) => (v >= 1 ? 0 : v + 1));
        return;
      }

      if (name === 'space') {
        if (focusedConfigIndex === 0) {
          setAdvancedThinkingEnabled((v) => !v);
        } else {
          setAdvancedModalityEnabled((v) => !v);
        }
        return;
      }

      if (name === 'return') {
        handleAdvancedConfigSubmit();
        return;
      }
    },
    { isActive: true },
  );

  // Render main auth selection
  const renderMainView = () => (
    <>
      <Box marginTop={1}>
        <DescriptiveRadioButtonSelect
          items={mainItems}
          initialIndex={initialAuthIndex}
          onSelect={handleMainSelect}
          itemGap={1}
        />
      </Box>
    </>
  );

  // Render region selection for Alibaba Cloud Coding Plan
  const renderRegionSelectView = () => (
    <>
      <Box marginTop={1}>
        <Text color={theme.text.primary}>
          {t('Choose based on where your account is registered')}
        </Text>
      </Box>
      <Box marginTop={1}>
        <DescriptiveRadioButtonSelect
          items={regionItems}
          initialIndex={regionIndex}
          onSelect={handleRegionSelect}
          onHighlight={(value) => {
            const index = regionItems.findIndex((item) => item.value === value);
            setRegionIndex(index);
          }}
          itemGap={1}
        />
      </Box>
      <Box marginTop={1}>
        <Text color={theme?.text?.secondary}>
          {t('Enter to select, ↑↓ to navigate, Esc to go back')}
        </Text>
      </Box>
    </>
  );

  // Render API key input for coding-plan mode
  const renderApiKeyInputView = () => {
    const isChina = region === CodingPlanRegion.CHINA;
    return (
      <Box marginTop={1}>
        <ApiKeyInput
          onSubmit={handleApiKeyInputSubmit}
          onCancel={handleGoBack}
          plan={{
            apiKeyUrl: isChina
              ? CODING_PLAN_API_KEY_URL
              : CODING_PLAN_INTL_API_KEY_URL,
            helpText: t(
              'Enter the Coding Plan API key from Alibaba Cloud ModelStudio.',
            ),
            placeholder: t('sk-...'),
          }}
        />
      </Box>
    );
  };

  const renderApiKeyTypeSelectView = () => (
    <>
      <Box marginTop={1}>
        <DescriptiveRadioButtonSelect
          items={apiKeyTypeItems}
          initialIndex={apiKeyTypeIndex}
          onSelect={handleApiKeyTypeSelect}
          onHighlight={(value) => {
            const index = apiKeyTypeItems.findIndex(
              (item) => item.value === value,
            );
            setApiKeyTypeIndex(index);
          }}
          itemGap={1}
        />
      </Box>
      <Box marginTop={1}>
        <Text color={theme?.text?.secondary}>
          {t('Enter to select, ↑↓ to navigate, Esc to go back')}
        </Text>
      </Box>
    </>
  );

  const renderAlibabaStandardRegionSelectView = () => (
    <>
      <Box marginTop={1}>
        <DescriptiveRadioButtonSelect
          items={alibabaStandardRegionItems}
          initialIndex={alibabaStandardRegionIndex}
          onSelect={handleAlibabaStandardRegionSelect}
          onHighlight={(value) => {
            const index = alibabaStandardRegionItems.findIndex(
              (item) => item.value === value,
            );
            setAlibabaStandardRegionIndex(index);
          }}
          itemGap={1}
        />
      </Box>
      <Box marginTop={1}>
        <Text color={theme?.text?.secondary}>
          {t('Enter to select, ↑↓ to navigate, Esc to go back')}
        </Text>
      </Box>
    </>
  );

  const renderAlibabaStandardApiKeyInputView = () => (
    <Box marginTop={1} flexDirection="column">
      <Box marginTop={1}>
        <Text color={theme.text.secondary}>
          Endpoint: {ALIBABA_STANDARD_API_KEY_ENDPOINTS[alibabaStandardRegion]}
        </Text>
      </Box>
      <Box marginTop={1}>
        <Text color={theme.text.secondary}>{t('Documentation')}:</Text>
      </Box>
      <Box marginTop={0}>
        <Link
          url={ALIBABA_STANDARD_API_DOCUMENTATION_URLS[alibabaStandardRegion]}
          fallback={false}
        >
          <Text color={theme.text.link}>
            {ALIBABA_STANDARD_API_DOCUMENTATION_URLS[alibabaStandardRegion]}
          </Text>
        </Link>
      </Box>
      <Box marginTop={1}>
        <TextInput
          value={alibabaStandardApiKey}
          onChange={(value) => {
            setAlibabaStandardApiKey(value);
            if (alibabaStandardApiKeyError) {
              setAlibabaStandardApiKeyError(null);
            }
          }}
          onSubmit={handleAlibabaStandardApiKeySubmit}
          placeholder="sk-..."
        />
      </Box>
      {alibabaStandardApiKeyError && (
        <Box marginTop={1}>
          <Text color={theme.status.error}>{alibabaStandardApiKeyError}</Text>
        </Box>
      )}
      <Box marginTop={1}>
        <Text color={theme.text.secondary}>
          {t('Enter to submit, Esc to go back')}
        </Text>
      </Box>
    </Box>
  );

  const renderAlibabaStandardModelIdInputView = () => (
    <Box marginTop={1} flexDirection="column">
      <Box marginTop={1}>
        <Text color={theme.text.secondary}>
          {t(
            'You can enter multiple model IDs, separated by commas. Examples: qwen3.5-plus,glm-5,kimi-k2.5',
          )}
        </Text>
      </Box>
      <Box marginTop={1}>
        <TextInput
          value={alibabaStandardModelId}
          onChange={(value) => {
            setAlibabaStandardModelId(value);
            if (alibabaStandardModelIdError) {
              setAlibabaStandardModelIdError(null);
            }
          }}
          onSubmit={handleAlibabaStandardModelSubmit}
          placeholder={ALIBABA_STANDARD_MODEL_IDS_PLACEHOLDER}
        />
      </Box>
      {alibabaStandardModelIdError && (
        <Box marginTop={1}>
          <Text color={theme.status.error}>{alibabaStandardModelIdError}</Text>
        </Box>
      )}
      <Box marginTop={1}>
        <Text color={theme.text.secondary}>
          {t('Enter to submit, Esc to go back')}
        </Text>
      </Box>
    </Box>
  );

  // Render custom protocol selection
  const renderCustomProtocolSelectView = () => (
    <>
      <Box marginTop={1}>
        <DescriptiveRadioButtonSelect
          items={protocolItems}
          initialIndex={customProtocolIndex}
          onSelect={handleCustomProtocolSelect}
          onHighlight={(value) => {
            const index = protocolItems.findIndex(
              (item) => item.value === value,
            );
            setCustomProtocolIndex(index);
          }}
          itemGap={1}
        />
      </Box>
      <Box marginTop={1}>
        <Text color={theme.text.secondary}>
          {t('Enter to select, ↑↓ to navigate, Esc to go back')}
        </Text>
      </Box>
    </>
  );

  // Render custom base URL input
  const renderCustomBaseUrlInputView = () => (
    <Box marginTop={1} flexDirection="column">
      <Box marginTop={1}>
        <Text color={theme.text.primary}>
          {t('Enter the API endpoint for this protocol.')}
        </Text>
      </Box>
      <Box marginTop={1}>
        <TextInput
          value={customBaseUrl}
          onChange={(value) => {
            setCustomBaseUrl(value);
            if (customBaseUrlError) {
              setCustomBaseUrlError(null);
            }
          }}
          onSubmit={handleCustomBaseUrlSubmit}
          placeholder="https://api.openai.com/v1"
        />
      </Box>
      {customBaseUrlError && (
        <Box marginTop={1}>
          <Text color={theme.status.error}>{customBaseUrlError}</Text>
        </Box>
      )}
      <Box marginTop={1}>
        <Link url={MODEL_PROVIDERS_DOCUMENTATION_URL} fallback={false}>
          <Text color={theme.text.link}>
            {t(
              'Need advanced generationConfig or capabilities? See documentation',
            )}
          </Text>
        </Link>
      </Box>
      <Box marginTop={1}>
        <Text color={theme.text.secondary}>
          {t('Enter to submit, Esc to go back')}
        </Text>
      </Box>
    </Box>
  );

  // Render custom API key input
  const renderCustomApiKeyInputView = () => (
    <Box marginTop={1} flexDirection="column">
      <Box marginTop={1}>
        <Text color={theme.text.primary}>
          {t('Enter the API key for this endpoint.')}
        </Text>
      </Box>
      <Box marginTop={1}>
        <TextInput
          value={customApiKey}
          onChange={(value) => {
            setCustomApiKey(value);
            if (customApiKeyError) {
              setCustomApiKeyError(null);
            }
          }}
          onSubmit={handleCustomApiKeySubmitLocal}
          placeholder="sk-..."
        />
      </Box>
      {customApiKeyError && (
        <Box marginTop={1}>
          <Text color={theme.status.error}>{customApiKeyError}</Text>
        </Box>
      )}
      <Box marginTop={1}>
        <Text color={theme.text.secondary}>
          {t('Enter to submit, Esc to go back')}
        </Text>
      </Box>
    </Box>
  );

  // Render custom model ID input
  const renderCustomModelIdInputView = () => (
    <Box marginTop={1} flexDirection="column">
      <Box marginTop={1}>
        <Text color={theme.text.primary}>
          {t('Enter one or more model IDs, separated by commas.')}
        </Text>
      </Box>
      <Box marginTop={1}>
        <TextInput
          value={customModelIds}
          onChange={(value) => {
            setCustomModelIds(value);
            if (customModelIdsError) {
              setCustomModelIdsError(null);
            }
          }}
          onSubmit={handleCustomModelIdSubmit}
          placeholder="qwen/qwen3-coder,openai/gpt-4.1"
        />
      </Box>
      {customModelIdsError && (
        <Box marginTop={1}>
          <Text color={theme.status.error}>{customModelIdsError}</Text>
        </Box>
      )}
      <Box marginTop={1}>
        <Text color={theme.text.secondary}>
          {t('Enter to submit, Esc to go back')}
        </Text>
      </Box>
    </Box>
  );

  // Render custom advanced config
  const renderCustomAdvancedConfigView = () => {
    const checkmark = (v: boolean) => (v ? '◉' : '○');
    const cursor = (index: number) =>
      focusedConfigIndex === index ? '›' : ' ';

    return (
      <Box marginTop={1} flexDirection="column">
        <Box marginTop={1}>
          <Text color={theme.text.primary}>
            {t('Optional: configure advanced generation settings.')}
          </Text>
        </Box>
        <Box marginTop={1} marginLeft={2}>
          <Text
            color={focusedConfigIndex === 0 ? theme.status.success : undefined}
          >
            {cursor(0)} {checkmark(advancedThinkingEnabled)}{' '}
            {t('Enable thinking')}
          </Text>
        </Box>
        <Box marginTop={0} marginLeft={4}>
          <Text color={theme.text.secondary}>
            {t(
              'Allows the model to perform extended reasoning before responding.',
            )}
          </Text>
        </Box>
        <Box marginTop={1} marginLeft={2}>
          <Text
            color={focusedConfigIndex === 1 ? theme.status.success : undefined}
          >
            {cursor(1)} {checkmark(advancedModalityEnabled)}{' '}
            {t('Enable modality')}
          </Text>
        </Box>
        <Box marginTop={0} marginLeft={4}>
          <Text color={theme.text.secondary}>
            {t('Enables image, video, and audio input/output capabilities.')}
          </Text>
        </Box>
        <Box marginTop={1}>
          <Text color={theme.text.secondary}>
            {t(
              '\u2191\u2193 to navigate, Space to toggle, Enter to continue, Esc to go back',
            )}
          </Text>
        </Box>
      </Box>
    );
  };

  // Render custom review JSON
  const renderCustomReviewJsonView = () => {
    const generatedEnvKey = generateCustomApiKeyEnvKey(
      customProtocol,
      customBaseUrl.trim(),
    );
    const normalizedIds = normalizeCustomModelIds(customModelIds);
    const maskedKey = maskApiKey(customApiKey);

    // Build generationConfig preview lines
    const hasThinking = advancedThinkingEnabled;
    const hasModality = advancedModalityEnabled;
    const hasGenConfig = hasThinking || hasModality;

    let genConfig: Record<string, unknown> | undefined;
    if (hasGenConfig) {
      genConfig = {};
      if (hasModality) {
        genConfig['modalities'] = {
          image: true,
          video: true,
          audio: true,
        };
      }
      if (hasThinking) {
        genConfig['extra_body'] = {
          enable_thinking: true,
        };
      }
    }

    const modelEntries = normalizedIds.map((id) => {
      const entry: Record<string, unknown> = {
        id,
        name: id,
        baseUrl: customBaseUrl.trim(),
        envKey: generatedEnvKey,
      };
      if (genConfig) {
        entry['generationConfig'] = genConfig;
      }
      return entry;
    });

    const preview = {
      env: { [generatedEnvKey]: maskedKey },
      modelProviders: {
        [customProtocol]: modelEntries,
      },
      security: {
        auth: {
          selectedType: customProtocol,
        },
      },
      model: {
        name: normalizedIds[0],
      },
    };

    const jsonPreview = JSON.stringify(preview, null, 2);

    return (
      <Box marginTop={1} flexDirection="column">
        <Box marginTop={1}>
          <Text color={theme.text.primary}>
            {t('The following JSON will be saved to settings.json:')}
          </Text>
        </Box>
        <Box marginTop={1}>
          <Text>{jsonPreview}</Text>
        </Box>
        <Box marginTop={1}>
          <Text color={theme.text.secondary}>
            {t('Enter to save, Esc to go back')}
          </Text>
        </Box>
      </Box>
    );
  };

  const renderOAuthProviderSelectView = () => (
    <>
      <Box marginTop={1}>
        <DescriptiveRadioButtonSelect
          items={oauthProviderItems}
          initialIndex={oauthProviderIndex}
          onSelect={handleOAuthProviderSelect}
          onHighlight={(value) => {
            const index = oauthProviderItems.findIndex(
              (item) => item.value === value,
            );
            setOAuthProviderIndex(index);
          }}
          itemGap={1}
        />
      </Box>
      <Box marginTop={1}>
        <Text color={theme?.text?.secondary}>
          {t('Enter to select, ↑↓ to navigate, Esc to go back')}
        </Text>
      </Box>
    </>
  );

  // Render LM Studio input - two-step flow
  const renderLmStudioInputView = () => (
    <>
      <Box marginTop={1}>
        <Text bold color={theme.text.primary}>
          {t('LM Studio')}
        </Text>
      </Box>
      <Box marginTop={0}>
        <Text color={theme.text.secondary}>
          {t('Connect to local models via LM Studio')}
        </Text>
      </Box>

      {lmStudioStep === 'baseUrl' && (
        <>
          <Box marginTop={1}>
            <Text color={theme.text.secondary}>{t('Server URL:')}</Text>
          </Box>
          <Box marginTop={0}>
            <TextInput
              value={lmStudioBaseUrl}
              onChange={setLmStudioBaseUrl}
              onSubmit={() => setLmStudioStep('apiKey')}
              placeholder={t('http://localhost:1234/v1')}
            />
          </Box>
          <Box marginTop={1}>
            <Text color={theme.text.secondary}>
              {t('↑↓ to navigate, Enter to continue, Esc to go back')}
            </Text>
          </Box>
        </>
      )}

      {lmStudioStep === 'apiKey' && (
        <>
          <Box marginTop={1}>
            <Text color={theme.text.secondary}>
              {t('Server')}:{' '}
              <Text color={theme.text.primary}>{lmStudioBaseUrl}</Text>
            </Text>
          </Box>
          <Box marginTop={1}>
            <Text color={theme.text.secondary}>{t('API Key:')}</Text>
          </Box>
          <Box marginTop={0}>
            <TextInput
              value={lmStudioApiKey}
              onChange={setLmStudioApiKey}
              onSubmit={handleLmStudioSubmit}
              placeholder={t('Enter your API key (optional for local models)')}
            />
          </Box>
          {errorMessage && (
            <Box marginTop={1}>
              <Text color={theme.status.error}>{errorMessage}</Text>
            </Box>
          )}
          <Box marginTop={1}>
            <Text color={theme.text.secondary}>
              {t('↑↓ to navigate, Enter to submit, Esc to go back')}
            </Text>
          </Box>
        </>
      )}
    </>
  );

  const renderOllamaInputView = () => (
    <>
      <Box marginTop={1}>
        <Text bold color={theme.text.primary}>
          {t('Ollama')}
        </Text>
      </Box>
      <Box marginTop={0}>
        <Text color={theme.text.secondary}>
          {t('Connect to local models via Ollama')}
        </Text>
      </Box>

      {ollamaStep === 'baseUrl' && (
        <>
          <Box marginTop={1}>
            <Text color={theme.text.secondary}>{t('Server URL:')}</Text>
          </Box>
          <Box marginTop={0}>
            <TextInput
              value={ollamaBaseUrl}
              onChange={setOllamaBaseUrl}
              onSubmit={() => setOllamaStep('apiKey')}
              placeholder={t('http://localhost:11434/v1')}
            />
          </Box>
          <Box marginTop={1}>
            <Text color={theme.text.secondary}>
              {t('↑↓ to navigate, Enter to continue, Esc to go back')}
            </Text>
          </Box>
        </>
      )}

      {ollamaStep === 'apiKey' && (
        <>
          <Box marginTop={1}>
            <Text color={theme.text.secondary}>
              {t('Server')}:{' '}
              <Text color={theme.text.primary}>{ollamaBaseUrl}</Text>
            </Text>
          </Box>
          <Box marginTop={1}>
            <Text color={theme.text.secondary}>{t('API Key:')}</Text>
          </Box>
          <Box marginTop={0}>
            <TextInput
              value={ollamaApiKey}
              onChange={setOllamaApiKey}
              onSubmit={handleOllamaSubmit}
              placeholder={t('Enter your API key (optional for local models)')}
            />
          </Box>
          {errorMessage && (
            <Box marginTop={1}>
              <Text color={theme.status.error}>{errorMessage}</Text>
            </Box>
          )}
          <Box marginTop={1}>
            <Text color={theme.text.secondary}>
              {t('↑↓ to navigate, Enter to fetch models, Esc to go back')}
            </Text>
          </Box>
        </>
      )}

      {ollamaStep === 'models' && (
        <>
          <Box marginTop={1}>
            <Text color={theme.text.secondary}>
              {t('Server')}:{' '}
              <Text color={theme.text.primary}>{ollamaBaseUrl}</Text>
            </Text>
          </Box>
          <Box marginTop={1}>
            <Text color={theme.text.secondary}>{t('Select Model:')}</Text>
          </Box>
          <Box marginTop={0}>
            {loadingOllamaModels ? (
              <Text color={theme.text.secondary}>{t('Loading models...')}</Text>
            ) : (
              <DescriptiveRadioButtonSelect
                items={ollamaModels.map((m) => ({
                  key: m,
                  title: m,
                  description: '',
                  value: m,
                }))}
                initialIndex={ollamaModels.indexOf(selectedOllamaModel)}
                onSelect={(val) => {
                  setSelectedOllamaModel(val);
                  handleOllamaModelSelect(val);
                }}
                maxItemsToShow={5}
              />
            )}
          </Box>
          {errorMessage && (
            <Box marginTop={1}>
              <Text color={theme.status.error}>{errorMessage}</Text>
            </Box>
          )}
          <Box marginTop={1}>
            <Text color={theme.text.secondary}>
              {t('↑↓ to navigate, Enter to select, Esc to go back')}
            </Text>
          </Box>
        </>
      )}
    </>
  );

  const getViewTitle = () => {
    switch (viewLevel) {
      case 'main':
        return t('Select Authentication Method');
      case 'region-select':
        return t('Select Region for Coding Plan');
      case 'api-key-input':
        return t('Enter Coding Plan API Key');
      case 'api-key-type-select':
        return t('Select API Key Type');
      case 'custom-protocol-select':
        return t('Step 1/6 \u00B7 Protocol');
      case 'custom-base-url-input':
        return t('Step 2/6 \u00B7 Base URL');
      case 'custom-api-key-input':
        return t('Step 3/6 \u00B7 API Key');
      case 'custom-model-id-input':
        return t('Step 4/6 \u00B7 Model IDs');
      case 'custom-advanced-config':
        return t('Step 5/6 \u00B7 Advanced Config');
      case 'custom-review-json':
        return t('Step 6/6 \u00B7 Review');
      case 'alibaba-standard-region-select':
        return t(
          'Select Region for Alibaba Cloud ModelStudio Standard API Key',
        );
      case 'alibaba-standard-api-key-input':
        return t('Enter Alibaba Cloud ModelStudio Standard API Key');
      case 'alibaba-standard-model-id-input':
        return t('Enter Model IDs');
      case 'oauth-provider-select':
        return t('Select OAuth Provider');
      case 'lm-studio-input':
        return t('LM Studio');
      case 'ollama-input':
        return t('Ollama');
      default:
        return t('Select Authentication Method');
    }
  };

  return (
    <Box
      borderStyle="single"
      borderColor={theme?.border?.default}
      flexDirection="column"
      padding={1}
      width="100%"
    >
      <Text bold>{getViewTitle()}</Text>

      {viewLevel === 'main' && renderMainView()}
      {viewLevel === 'region-select' && renderRegionSelectView()}
      {viewLevel === 'api-key-input' && renderApiKeyInputView()}
      {viewLevel === 'api-key-type-select' && renderApiKeyTypeSelectView()}
      {viewLevel === 'alibaba-standard-region-select' &&
        renderAlibabaStandardRegionSelectView()}
      {viewLevel === 'alibaba-standard-api-key-input' &&
        renderAlibabaStandardApiKeyInputView()}
      {viewLevel === 'alibaba-standard-model-id-input' &&
        renderAlibabaStandardModelIdInputView()}
      {viewLevel === 'custom-protocol-select' &&
        renderCustomProtocolSelectView()}
      {viewLevel === 'custom-base-url-input' && renderCustomBaseUrlInputView()}
      {viewLevel === 'custom-api-key-input' && renderCustomApiKeyInputView()}
      {viewLevel === 'custom-model-id-input' && renderCustomModelIdInputView()}
      {viewLevel === 'custom-advanced-config' &&
        renderCustomAdvancedConfigView()}
      {viewLevel === 'custom-review-json' && renderCustomReviewJsonView()}
      {viewLevel === 'oauth-provider-select' && renderOAuthProviderSelectView()}
      {viewLevel === 'lm-studio-input' && renderLmStudioInputView()}
      {viewLevel === 'ollama-input' && renderOllamaInputView()}

      {(authError || errorMessage) && (
        <Box marginTop={1}>
          <Text color={theme.status.error}>{authError || errorMessage}</Text>
        </Box>
      )}

      {viewLevel === 'main' && (
        <>
          {/* <Box marginTop={1}>
            <Text color={theme.text.secondary}>
              {t('Enter to select, \u2191\u2193 to navigate, Esc to close')}
            </Text>
          </Box> */}
          <Box marginY={1}>
            <Text color={theme.border.default}>{'\u2500'.repeat(80)}</Text>
          </Box>
          <Box>
            <Text color={theme.text.primary}>
              {t('Terms of Services and Privacy Notice')}:
            </Text>
          </Box>
          <Box>
            <Link
              url="https://qwenlm.github.io/qwen-code-docs/en/users/support/tos-privacy/"
              fallback={false}
            >
              <Text color={theme.text.secondary} underline>
                https://qwenlm.github.io/qwen-code-docs/en/users/support/tos-privacy/
              </Text>
            </Link>
          </Box>
        </>
      )}
    </Box>
  );
}
