import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import {
  Box,
  IconButton,
  Tooltip,
  Typography,
  Modal,
  Backdrop,
} from '@mui/material';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import CheckIcon from '@mui/icons-material/Check';
import CloseIcon from '@mui/icons-material/Close';

interface MarkdownMessageProps {
  content: string;
}

interface CodeBlockProps {
  inline?: boolean;
  className?: string;
  children: React.ReactNode;
}

interface ImageComponentProps {
  src?: string;
  alt?: string;
}

// Image component with lightbox modal
const ImageComponent: React.FC<ImageComponentProps> = ({ src, alt }) => {
  const [open, setOpen] = useState(false);
  const [imageError, setImageError] = useState(false);

  if (!src || imageError) return null;

  return (
    <>
      <Box
        component="img"
        src={src}
        alt={alt || 'Image'}
        onClick={() => setOpen(true)}
        onError={() => setImageError(true)}
        sx={{
          maxWidth: '100%',
          maxHeight: 300,
          borderRadius: 2,
          cursor: 'pointer',
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
          transition: 'transform 0.2s, box-shadow 0.2s',
          display: 'block',
          my: 1.5,
          '&:hover': {
            transform: 'scale(1.02)',
            boxShadow: '0 4px 16px rgba(0,0,0,0.15)',
          },
        }}
      />
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        closeAfterTransition
        slots={{ backdrop: Backdrop }}
        slotProps={{
          backdrop: {
            timeout: 300,
            sx: { backgroundColor: 'rgba(0,0,0,0.85)' },
          },
        }}
      >
        <Box
          sx={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            outline: 'none',
            maxWidth: '90vw',
            maxHeight: '90vh',
          }}
        >
          <IconButton
            onClick={() => setOpen(false)}
            sx={{
              position: 'absolute',
              top: -40,
              right: 0,
              color: 'white',
              '&:hover': { bgcolor: 'rgba(255,255,255,0.1)' },
            }}
          >
            <CloseIcon />
          </IconButton>
          <Box
            component="img"
            src={src}
            alt={alt || 'Image'}
            sx={{
              maxWidth: '90vw',
              maxHeight: '85vh',
              objectFit: 'contain',
              borderRadius: 2,
            }}
          />
          {alt && (
            <Typography
              variant="caption"
              sx={{
                display: 'block',
                textAlign: 'center',
                color: 'white',
                mt: 1,
                opacity: 0.8,
              }}
            >
              {alt}
            </Typography>
          )}
        </Box>
      </Modal>
    </>
  );
};

// Extract YouTube video ID from URL
const getYouTubeId = (url: string): string | null => {
  const match = url.match(
    /(?:youtube\.com\/(?:watch\?v=|embed\/|v\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/
  );
  return match ? match[1] : null;
};

interface YouTubeEmbedProps {
  videoId: string;
  title?: string;
}

// YouTube embed component
const YouTubeEmbed: React.FC<YouTubeEmbedProps> = ({ videoId, title }) => (
  <Box
    sx={{
      my: 2,
      borderRadius: 2,
      overflow: 'hidden',
      boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
    }}
  >
    <Box
      component="iframe"
      src={`https://www.youtube.com/embed/${videoId}`}
      title={title || 'YouTube video'}
      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
      allowFullScreen
      sx={{
        width: '100%',
        aspectRatio: '16 / 9',
        border: 'none',
        display: 'block',
      }}
    />
  </Box>
);

// Code block with language header and copy button
const CodeBlock: React.FC<CodeBlockProps> = ({ inline, className, children }) => {
  const [copied, setCopied] = useState(false);
  const match = /language-(\w+)/.exec(className || '');
  const language = match ? match[1] : '';
  const codeString = String(children).replace(/\n$/, '');

  const handleCopy = () => {
    navigator.clipboard.writeText(codeString);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (inline) {
    return (
      <code
        style={{
          backgroundColor: 'rgba(0, 0, 0, 0.08)',
          padding: '2px 6px',
          borderRadius: 4,
          fontFamily: '"Fira Code", "Consolas", monospace',
          fontSize: '0.875em',
        }}
      >
        {children}
      </code>
    );
  }

  return (
    <Box sx={{ position: 'relative', my: 2 }}>
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          bgcolor: '#282c34',
          px: 2,
          py: 0.5,
          borderTopLeftRadius: 8,
          borderTopRightRadius: 8,
        }}
      >
        <Typography
          variant="caption"
          sx={{ color: '#abb2bf', textTransform: 'uppercase' }}
        >
          {language || 'code'}
        </Typography>
        <Tooltip title={copied ? 'Copied!' : 'Copy code'}>
          <IconButton size="small" onClick={handleCopy} sx={{ color: '#abb2bf' }}>
            {copied ? <CheckIcon fontSize="small" /> : <ContentCopyIcon fontSize="small" />}
          </IconButton>
        </Tooltip>
      </Box>
      <SyntaxHighlighter
        style={oneDark}
        language={language || 'text'}
        PreTag="div"
        customStyle={{
          margin: 0,
          borderTopLeftRadius: 0,
          borderTopRightRadius: 0,
          borderBottomLeftRadius: 8,
          borderBottomRightRadius: 8,
        }}
      >
        {codeString}
      </SyntaxHighlighter>
    </Box>
  );
};

const MarkdownMessage: React.FC<MarkdownMessageProps> = ({ content }) => {
  return (
    <Box
      sx={{
        '& p': {
          m: 0,
          mb: 1,
          '&:last-child': { mb: 0 },
        },
        '& ul, & ol': {
          m: 0,
          pl: 2.5,
          mb: 1,
        },
        '& li': {
          mb: 0.5,
        },
        '& h1, & h2, & h3, & h4, & h5, & h6': {
          mt: 1.5,
          mb: 1,
          fontWeight: 600,
          '&:first-of-type': { mt: 0 },
        },
        '& h1': { fontSize: '1.5rem' },
        '& h2': { fontSize: '1.25rem' },
        '& h3': { fontSize: '1.1rem' },
        '& blockquote': {
          borderLeft: '4px solid #1877F2',
          pl: 2,
          py: 0.5,
          my: 1,
          bgcolor: 'rgba(24, 119, 242, 0.05)',
          borderRadius: 1,
        },
        '& a': {
          color: '#1877F2',
          textDecoration: 'none',
          '&:hover': {
            textDecoration: 'underline',
          },
        },
        '& table': {
          borderCollapse: 'collapse',
          width: '100%',
          my: 1,
        },
        '& th, & td': {
          border: '1px solid #ddd',
          p: 1,
          textAlign: 'left',
        },
        '& th': {
          bgcolor: '#f5f5f5',
          fontWeight: 600,
        },
        '& hr': {
          border: 'none',
          borderTop: '1px solid #ddd',
          my: 2,
        },
        '& img': {
          maxWidth: '100%',
          borderRadius: 1,
        },
        fontSize: '0.875rem',
        lineHeight: 1.6,
      }}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          code: ({ className, children, ...props }) => {
            const isInline = !className;
            return (
              <CodeBlock inline={isInline} className={className} {...props}>
                {children}
              </CodeBlock>
            );
          },
          img: ({ src, alt }) => <ImageComponent src={src} alt={alt} />,
          a: ({ href, children }) => {
            if (href) {
              const ytId = getYouTubeId(href);
              if (ytId) {
                return <YouTubeEmbed videoId={ytId} title={String(children)} />;
              }
            }
            return (
              <a href={href} target="_blank" rel="noopener noreferrer">
                {children}
              </a>
            );
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </Box>
  );
};

export default MarkdownMessage;
